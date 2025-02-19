declare module 'base32.js' {
  const base32: any
  export default base32
}

declare module 'ipv6-normalize' {
  const normalize: (address: string) => string
  export default normalize
}

declare module 'punycode.js' {
  const punycode: {
    toUnicode: (domain: string) => string
    toASCII: (domain: string) => string
  }
  export default punycode
}
