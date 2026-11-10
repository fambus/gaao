export const isLatin = s => /^[\p{Script=Latin}\p{N}\p{P}\p{S}\s]*$/u.test(s);
export const plainify = s => s.normalize("NFD").replace(/[\u0300-\u036F]/g, "").normalize("NFC");
