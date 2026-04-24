module.exports = async ({ req, res, log }) => {
  const endpoint = String(process.env.APPWRITE_ENDPOINT || "").trim();
  const projectId = String(process.env.APPWRITE_PROJECT_ID || "").trim();
  const apiKey = String(process.env.APPWRITE_API_KEY || "").trim();
  const databaseId = String(process.env.APPWRITE_DATABASE_ID || "").trim();
  const membersCollectionId = String(process.env.APPWRITE_MEMBERS_COLLECTION_ID || "members").trim();
  const feesCollectionId = String(process.env.APPWRITE_MEMBERSHIP_FEES_COLLECTION_ID || "membership_fees").trim();

  const creditorName = String(process.env.SEPA_CREDITOR_NAME || "").trim();
  const creditorIban = String(process.env.SEPA_CREDITOR_IBAN || "").trim();
  const creditorBic = String(process.env.SEPA_CREDITOR_BIC || "").trim();
  const creditorId = String(process.env.SEPA_CREDITOR_ID || "").trim();
  const sequenceType = String(process.env.SEPA_SEQUENCE_TYPE || "RCUR").trim().toUpperCase();
  const localInstrument = String(process.env.SEPA_LOCAL_INSTRUMENT || "CORE").trim().toUpperCase();
  const collectionDateOverride = String(process.env.SEPA_COLLECTION_DATE || "").trim();
  const mandateDateOverride = String(process.env.SEPA_DEFAULT_MANDATE_DATE || "").trim();
  const currency = String(process.env.SEPA_CURRENCY || "EUR").trim().toUpperCase();

  if (!endpoint || !projectId || !apiKey || !databaseId) {
    return res.json(
      {
        ok: false,
        error: "Missing APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY, or APPWRITE_DATABASE_ID."
      },
      500
    );
  }

  if (!creditorName || !creditorIban || !creditorId) {
    return res.json(
      {
        ok: false,
        error: "Missing SEPA_CREDITOR_NAME, SEPA_CREDITOR_IBAN, or SEPA_CREDITOR_ID."
      },
      500
    );
  }

  const parseBody = () => {
    try {
      if (!req || req.body === undefined || req.body === null) return {};
      if (typeof req.body === "string") {
        return req.body.trim() ? JSON.parse(req.body) : {};
      }
      if (typeof req.body === "object") return req.body;
      return {};
    } catch {
      return {};
    }
  };

  const body = parseBody();
  const requestedPeriod = String(body.feePeriod || "").trim();
  if (!/^Q[1-4]_\d{4}$/.test(requestedPeriod)) {
    return res.json({ ok: false, error: "feePeriod is required and must look like Q2_2026." }, 400);
  }

  const base = endpoint.replace(/\/$/, "");
  const headers = {
    "X-Appwrite-Project": projectId,
    "X-Appwrite-Key": apiKey,
    "Content-Type": "application/json"
  };

  const request = async (pathname) => {
    const response = await fetch(`${base}${pathname}`, { method: "GET", headers });
    const payload = await response.json().catch(() => ({}));
    return { response, payload };
  };

  const limitQuery = encodeURIComponent(JSON.stringify({ method: "limit", values: [5000] }));

  const listAllRows = async (tableId) => {
    const { response, payload } = await request(
      `/tablesdb/${encodeURIComponent(databaseId)}/tables/${encodeURIComponent(tableId)}/rows?queries[0]=${limitQuery}`
    );
    if (!response.ok) {
      throw new Error(String(payload?.message || `Could not read table ${tableId}.`));
    }
    return Array.isArray(payload?.rows) ? payload.rows : [];
  };

  const listAllDocuments = async (collectionId) => {
    const { response, payload } = await request(
      `/databases/${encodeURIComponent(databaseId)}/collections/${encodeURIComponent(collectionId)}/documents?queries[0]=${limitQuery}`
    );
    if (!response.ok) {
      throw new Error(String(payload?.message || `Could not read collection ${collectionId}.`));
    }
    return Array.isArray(payload?.documents) ? payload.documents : [];
  };

  const listAppwriteRecords = async (resourceId) => {
    try {
      return await listAllRows(resourceId);
    } catch (tableError) {
      try {
        return await listAllDocuments(resourceId);
      } catch (documentError) {
        const combinedMessage = `Could not load ${resourceId}. Tables error: ${String(tableError?.message || tableError)} Legacy collections error: ${String(documentError?.message || documentError)}`;
        throw new Error(combinedMessage);
      }
    }
  };

  const sanitizeIban = (value) => String(value || "").replace(/\s+/g, "").toUpperCase();
  const normalizeDate = (value) => {
    const text = String(value || "").trim();
    if (!text) return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
    const date = new Date(text);
    if (Number.isNaN(date.getTime())) return "";
    return date.toISOString().slice(0, 10);
  };
  const todayIso = () => new Date().toISOString().slice(0, 10);
  const plusDaysIso = (days) => {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() + Number(days || 0));
    return date.toISOString().slice(0, 10);
  };
  const xmlEscape = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  const amountString = (amountCents) => (Number(amountCents || 0) / 100).toFixed(2);
  const compactName = (firstName, lastName, fallback) =>
    String(`${String(firstName || "").trim()} ${String(lastName || "").trim()}`.trim() || fallback || "Unknown member");
  const debitableStatuses = new Set(["pending", "partial", "not_collected"]);
  const nonDebitableStatuses = new Set(["paid", "paid_rookie_fee", "paid_with_fee", "exempt", "exit", "not_applicable"]);

  try {
    const [memberRows, feeRows] = await Promise.all([
      listAppwriteRecords(membersCollectionId),
      listAppwriteRecords(feesCollectionId)
    ]);

    const membersById = new Map(
      memberRows.map((member) => [String(member?.$id || member?.id || "").trim(), member])
    );

    const periodFees = feeRows.filter((fee) => String(fee?.fee_period || "").trim() === requestedPeriod);
    if (!periodFees.length) {
      return res.json({ ok: false, error: `No fee rows found for ${requestedPeriod}.` }, 404);
    }

    const latestFeeRowsByMember = new Map();
    [...feeRows]
      .sort((left, right) => {
        const leftKey = String(left?.fee_period || left?.season_label || left?.due_date || left?.$createdAt || "");
        const rightKey = String(right?.fee_period || right?.season_label || right?.due_date || right?.$createdAt || "");
        return rightKey.localeCompare(leftKey);
      })
      .forEach((fee) => {
        const memberId = String(fee?.member_id || "").trim();
        if (!memberId || latestFeeRowsByMember.has(memberId)) return;
        latestFeeRowsByMember.set(memberId, fee);
      });

    const transactions = [];
    const includedMembers = [];
    const skippedMembers = [];
    for (const fee of periodFees) {
      const feeStatus = String(fee?.status || "").trim().toLowerCase();
      const memberId = String(fee?.member_id || "").trim();
      const member = membersById.get(memberId);
      const memberName = compactName(member?.first_name, member?.last_name, member?.displayName || member?.display_name);
      const feeId = String(fee?.$id || fee?.id || "").trim();
      const amountCents = Math.max(0, Number(fee?.amount_cents || 0));
      const paidCents = Math.max(0, Number(fee?.paid_cents || 0));
      const outstandingCents = Math.max(0, amountCents - paidCents);
      const fallbackFee = latestFeeRowsByMember.get(memberId) || null;
      const debtorIban = sanitizeIban(fee?.iban || fallbackFee?.iban);
      const mandateId = String(memberId || feeId || "").trim();

      const skip = (reason) => {
        skippedMembers.push({
          memberId,
          feeId,
          name: memberName,
          status: feeStatus || "unknown",
          amount: amountString(amountCents),
          paidAmount: amountString(paidCents),
          outstandingAmount: amountString(outstandingCents),
          ibanPresent: Boolean(debtorIban),
          reason
        });
      };

      if (nonDebitableStatuses.has(feeStatus)) {
        skip(`status_${feeStatus}`);
        continue;
      }
      if (feeStatus && !debitableStatuses.has(feeStatus)) {
        skip(`status_${feeStatus}`);
        continue;
      }
      if (!member) {
        skip("missing_member");
        continue;
      }
      if (!outstandingCents) {
        skip("no_outstanding_amount");
        continue;
      }
      if (!debtorIban) {
        skip("missing_iban");
        continue;
      }
      if (!mandateId) {
        skip("missing_mandate_id");
        continue;
      }

      const debtorName = memberName;

      transactions.push({
        memberId,
        feeId,
        debtorName,
        debtorIban,
        debtorBic: String(fee?.bic || fallbackFee?.bic || "").trim().toUpperCase(),
        mandateId,
        mandateDate: normalizeDate(fee?.mandate_date || fallbackFee?.mandate_date) || mandateDateOverride || todayIso(),
        amountCents: outstandingCents,
        dueDate: normalizeDate(fee?.due_date) || "",
        description: `${requestedPeriod} membership fee`
      });
      includedMembers.push({
        memberId,
        feeId,
        name: debtorName,
        status: feeStatus || "pending",
        amount: amountString(amountCents),
        paidAmount: amountString(paidCents),
        outstandingAmount: amountString(outstandingCents),
        iban: debtorIban
      });
    }

    if (!transactions.length) {
      return res.json(
        {
          ok: false,
          error: `No debit-ready rows found for ${requestedPeriod}. Check IBAN values and fee statuses.`
        },
        400
      );
    }

    const collectionDate = normalizeDate(collectionDateOverride) || transactions.find((item) => item.dueDate)?.dueDate || plusDaysIso(5);
    const messageStamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
    const groupMessageId = `UWEMP-${requestedPeriod}-${messageStamp}`;
    const paymentInfoId = `PI-${requestedPeriod}-${messageStamp}`;
    const transactionCount = transactions.length;
    const controlSum = transactions.reduce((sum, item) => sum + Number(item.amountCents || 0), 0);
    const creditorIbanNormalized = sanitizeIban(creditorIban);

    const transactionXml = transactions
      .map((item, index) => {
        const txId = `${requestedPeriod}-${String(index + 1).padStart(4, "0")}`;
        const debtorAgentXml = item.debtorBic
          ? `<DbtrAgt><FinInstnId><BIC>${xmlEscape(item.debtorBic)}</BIC></FinInstnId></DbtrAgt>`
          : `<DbtrAgt><FinInstnId><Othr><Id>NOTPROVIDED</Id></Othr></FinInstnId></DbtrAgt>`;
        return `
      <DrctDbtTxInf>
        <PmtId>
          <EndToEndId>${xmlEscape(txId)}</EndToEndId>
        </PmtId>
        <InstdAmt Ccy="${xmlEscape(currency)}">${amountString(item.amountCents)}</InstdAmt>
        <DrctDbtTx>
          <MndtRltdInf>
            <MndtId>${xmlEscape(item.mandateId)}</MndtId>
            <DtOfSgntr>${xmlEscape(item.mandateDate)}</DtOfSgntr>
          </MndtRltdInf>
        </DrctDbtTx>
        ${debtorAgentXml}
        <Dbtr>
          <Nm>${xmlEscape(item.debtorName)}</Nm>
        </Dbtr>
        <DbtrAcct>
          <Id>
            <IBAN>${xmlEscape(item.debtorIban)}</IBAN>
          </Id>
        </DbtrAcct>
        <RmtInf>
          <Ustrd>${xmlEscape(item.description)}</Ustrd>
        </RmtInf>
      </DrctDbtTxInf>`.trim();
      })
      .join("\n");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.008.001.02" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <CstmrDrctDbtInitn>
    <GrpHdr>
      <MsgId>${xmlEscape(groupMessageId)}</MsgId>
      <CreDtTm>${xmlEscape(new Date().toISOString())}</CreDtTm>
      <NbOfTxs>${transactionCount}</NbOfTxs>
      <CtrlSum>${amountString(controlSum)}</CtrlSum>
      <InitgPty>
        <Nm>${xmlEscape(creditorName)}</Nm>
      </InitgPty>
    </GrpHdr>
    <PmtInf>
      <PmtInfId>${xmlEscape(paymentInfoId)}</PmtInfId>
      <PmtMtd>DD</PmtMtd>
      <BtchBookg>true</BtchBookg>
      <NbOfTxs>${transactionCount}</NbOfTxs>
      <CtrlSum>${amountString(controlSum)}</CtrlSum>
      <PmtTpInf>
        <SvcLvl>
          <Cd>SEPA</Cd>
        </SvcLvl>
        <LclInstrm>
          <Cd>${xmlEscape(localInstrument)}</Cd>
        </LclInstrm>
        <SeqTp>${xmlEscape(sequenceType)}</SeqTp>
      </PmtTpInf>
      <ReqdColltnDt>${xmlEscape(collectionDate)}</ReqdColltnDt>
      <Cdtr>
        <Nm>${xmlEscape(creditorName)}</Nm>
      </Cdtr>
      <CdtrAcct>
        <Id>
          <IBAN>${xmlEscape(creditorIbanNormalized)}</IBAN>
        </Id>
      </CdtrAcct>
      ${creditorBic ? `<CdtrAgt><FinInstnId><BIC>${xmlEscape(creditorBic)}</BIC></FinInstnId></CdtrAgt>` : `<CdtrAgt><FinInstnId><Othr><Id>NOTPROVIDED</Id></Othr></FinInstnId></CdtrAgt>`}
      <ChrgBr>SLEV</ChrgBr>
      <CdtrSchmeId>
        <Id>
          <PrvtId>
            <Othr>
              <Id>${xmlEscape(creditorId)}</Id>
              <SchmeNm>
                <Prtry>SEPA</Prtry>
              </SchmeNm>
            </Othr>
          </PrvtId>
        </Id>
      </CdtrSchmeId>
${transactionXml}
    </PmtInf>
  </CstmrDrctDbtInitn>
</Document>
`;

    const fileName = `SEPA_Lastschrift_${requestedPeriod}.xml`;
    const xmlBase64 = Buffer.from(xml, "utf-8").toString("base64");

    log(`SEPA export generated for ${requestedPeriod} with ${transactionCount} transactions.`);
    return res.json({
      ok: true,
      fileName,
      xmlBase64,
      summary: {
        feePeriod: requestedPeriod,
        transactionCount,
        totalAmount: amountString(controlSum),
        collectionDate,
        skippedRows: skippedMembers.length,
        sourceRows: periodFees.length
      },
      preview: {
        feePeriod: requestedPeriod,
        included: includedMembers,
        skipped: skippedMembers
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not generate SEPA XML.";
    log(`SEPA export failed: ${message}`);
    return res.json(
      {
        ok: false,
        error: message
      },
      500
    );
  }
};
