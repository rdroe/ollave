/**
 *
 * translateGeneric('a.2')
 * 0.2
 * translateGeneric('aa.2')
 * 26.2
 * translateGeneric('aaa.2')
 * 52.2
 * translateGeneric('b.2')
 * 1.2
 * translateGeneric('c.7')
 * 2.7
 * translateGeneric('d.1')
 * 3.1
 * translateGeneric('e.9')
 * 4.9
 *
 * @param numberLetterInput
 * @returns
 */

export const convertAlphadex = (numberLetterInput: string): number => {
    const [input, decimalRaw] = numberLetterInput.split('.')
    const decimalFloat = parseFloat(`0.${decimalRaw}`)
    const decimal = isNaN(decimalFloat) ? 0 : decimalFloat
    let letter: string | null = null
    let nthAlphabet = 0
    let negative = false
    if (input[0] === '-') {
      letter = input[1]
      nthAlphabet = input.length - 2
      negative = true
    } else {
      letter = input[0]
      nthAlphabet = input.length - 1
    }
    const alphabet = 'abcdefghijklmnopqrstuvwxyz'
    const rawIndex = alphabet.indexOf(letter.toLowerCase())
    const integer = rawIndex + nthAlphabet * alphabet.length
  
    let final: number = -1
    if (negative) {
      final = 0 - (integer + decimal)
    } else {
      final = integer + decimal
    }
    return final
  }
  
  /**
   * Reverses translateGeneric
   *
   * For example:
   * timelineFromNumber(0)
   * "a"
   * timelineFromNumber(0.1)
   * "a.1"
   * timelineFromNumber(26)
   * "aa"
   * timelineFromNumber(2.7)
   * "c.7"
   * timelineFromNumber(52.2)
   * "aaa.2"
   * timelineFromNumber(-1)
   * "-a"
   * timelineFromNumber(-0.1)
   * "-a.1"
   * timelineFromNumber(-26)
   * @param number
   * @returns string
   */
  export const numberToAlphadex = (signedNumber: number): string => {
    const number = Math.abs(signedNumber)
    const isNeg = number !== signedNumber
    const roundedToTenths = Math.round(number * 10) / 10
    const alphabet = 'abcdefghijklmnopqrstuvwxyz'
    const letter = alphabet[Math.floor(roundedToTenths) % alphabet.length]
    const nthAlphabet = Math.floor(roundedToTenths / alphabet.length)
    // repeat the letter nthAlphabet times
    const letterString = letter.repeat(nthAlphabet + 1)
    const decimal = roundedToTenths - Math.floor(roundedToTenths)
    const roundedDecimal = Math.round(decimal * 10) / 10
    return `${isNeg ? '-' : ''}${letterString}${roundedDecimal === 0 ? `.0` : roundedDecimal}`.replace(
      '0.',
      '.'
    )
  }
  ;(() => {
    if (typeof window !== 'undefined') {
      for (let i = 0; i < 1000; i = i + 0.1) {
        const iRounded = Math.round(i * 10) / 10
        const tl = numberToAlphadex(iRounded)
        const translated = convertAlphadex(tl)
        if (iRounded !== translated) {
          console.error(
            iRounded,
            `tlCheck err:timeline / retranslated: ${tl} | ${translated}`
          )
        } else {
          // console.log("tlCheck", i, tl, translated);
        }
      }
    }
  })()
  declare global {
    interface Window {
      convertAlphadex: typeof convertAlphadex
      numberToAlphadex: typeof numberToAlphadex
    }
  }
  if (typeof window !== 'undefined') {
    window.convertAlphadex = convertAlphadex
    window.numberToAlphadex = numberToAlphadex
  }
  