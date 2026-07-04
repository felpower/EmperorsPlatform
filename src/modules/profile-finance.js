(function () {
  function normalizeIbanText(value) {
    return String(value || "").replace(/\s+/g, "").toUpperCase().trim();
  }

  function memberFeesByPeriod(fees, memberId) {
    const map = new Map();
    (Array.isArray(fees) ? fees : [])
      .filter((fee) => String(fee.memberId) === String(memberId))
      .forEach((fee) => {
        if (fee.feePeriod) map.set(fee.feePeriod, fee);
      });
    return map;
  }

  function feePeriodSortValue(feePeriod) {
    const match = /^Q([1-4])_(\d{4})$/.exec(String(feePeriod || "").trim());
    if (!match) return 0;
    const quarter = Number(match[1]);
    const year = Number(match[2]);
    return year * 10 + quarter;
  }

  function memberIban(member, fees, memberId) {
    const memberLevelIban = String(member?.iban || "").trim();
    if (memberLevelIban) return memberLevelIban;
    const newestFeeWithIban = (Array.isArray(fees) ? fees : [])
      .filter((fee) => String(fee.memberId) === String(memberId) && String(fee.iban || "").trim())
      .sort((left, right) => feePeriodSortValue(right.feePeriod) - feePeriodSortValue(left.feePeriod))[0] || null;
    return String(newestFeeWithIban?.iban || "").trim();
  }

  async function updateMemberSensitiveFinance(params) {
    const {
      currentAccessRole,
      backendClient,
      memberId,
      iban,
      statusByFeeId,
      fees,
      updateFeeRow
    } = params || {};

    if (currentAccessRole !== "admin") {
      throw new Error("Only admins can change IBAN or quarter payment statuses.");
    }

    const normalizedIban = normalizeIbanText(iban);
    if (backendClient) {
      const memberUpdate = await backendClient
        .from("members")
        .update({ iban: normalizedIban || null })
        .eq("id", String(memberId || ""));
      if (memberUpdate.error && !/column|attribute|unknown|schema/i.test(String(memberUpdate.error?.message || ""))) {
        throw memberUpdate.error;
      }
    }

    const memberFees = (Array.isArray(fees) ? fees : []).filter((fee) => String(fee.memberId) === String(memberId));
    for (const fee of memberFees) {
      await updateFeeRow({
        feeId: fee.id,
        status: statusByFeeId[String(fee.id)] || fee.status,
        amount: Number(fee.amount || 0),
        paidAmount: Number(fee.paidAmount || 0),
        note: String(fee.note || ""),
        iban: normalizedIban
      });
    }
  }

  window.ClubHubModules = window.ClubHubModules || {};
  window.ClubHubModules.profileFinance = {
    memberFeesByPeriod,
    memberIban,
    updateMemberSensitiveFinance
  };
})();
