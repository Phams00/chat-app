function normalizePhoneNumber(phoneNumber) {
  if (typeof phoneNumber !== 'string' || !/^\+?[\d\s().-]+$/.test(phoneNumber.trim())) {
    throw new Error('Masukkan nomor telepon yang valid');
  }

  let digits = phoneNumber.replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('62')) {
    if (digits.slice(2).startsWith('0')) digits = `62${digits.slice(3)}`;
  } else if (digits.startsWith('0')) {
    digits = `62${digits.slice(1)}`;
  } else {
    digits = `62${digits}`;
  }

  if (digits.length < 9 || digits.length > 15) {
    throw new Error('Nomor telepon harus berisi 7 sampai 13 digit setelah kode negara');
  }

  return `+${digits}`;
}

function phoneNumberCandidates(phoneNumber) {
  const normalized = normalizePhoneNumber(phoneNumber);
  const nationalNumber = normalized.slice(3);

  return [...new Set([
    phoneNumber.trim(),
    normalized,
    `0${nationalNumber}`,
    `62${nationalNumber}`,
    nationalNumber,
  ])];
}

module.exports = { normalizePhoneNumber, phoneNumberCandidates };
