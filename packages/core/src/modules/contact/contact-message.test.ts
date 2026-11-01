import { describe, expect, test } from "vitest"

import {
  type ContactMessage,
  ContactMessageSchema,
  contactMessageSubject,
  formatContactMessage,
} from "./contact-message.ts"

const contact: ContactMessage = {
  email: "lumen@example.com",
  phone: "+420 777 000 000",
  message: "We run a café and would like to try Payky.",
  businessName: "Café Lumen",
  place: "Brno",
  language: "cs",
}

describe("formatContactMessage", () => {
  test("puts how to reach the sender above the message", () => {
    expect(formatContactMessage(contact)).toBe(
      [
        "Email: lumen@example.com",
        "Phone: +420 777 000 000",
        "Business: Café Lumen",
        "Place: Brno",
        "Language: Czech",
        "",
        "We run a café and would like to try Payky.",
      ].join("\n")
    )
  })

  test("is just the contact when nothing else was given", () => {
    expect(
      formatContactMessage({ phone: "+421 900 000 000", language: "sk" })
    ).toBe(["Phone: +421 900 000 000", "Language: Slovak"].join("\n"))
  })
})

describe("contactMessageSubject", () => {
  test("names the business when one was given, else the contact", () => {
    expect(contactMessageSubject(contact, "Payky")).toBe(
      "Payky web contact: Café Lumen"
    )
    expect(
      contactMessageSubject({ ...contact, businessName: undefined }, "Payky")
    ).toBe("Payky web contact: lumen@example.com")
  })

  test("names the app whose landing it came from", () => {
    expect(contactMessageSubject(contact, "Finito")).toBe(
      "Finito web contact: Café Lumen"
    )
  })
})

describe("ContactMessageSchema", () => {
  test("requires an email or a phone", () => {
    expect(
      ContactMessageSchema.safeParse({ message: "Hi", language: "en" }).success
    ).toBe(false)
    expect(
      ContactMessageSchema.safeParse({ phone: "777000000", language: "en" })
        .success
    ).toBe(true)
  })

  test("requires a known language and trims what it accepts", () => {
    expect(
      ContactMessageSchema.safeParse({
        email: "a@b.cz",
        language: "de",
      }).success
    ).toBe(false)
    expect(
      ContactMessageSchema.parse({
        email: "a@b.cz",
        message: " Hi ",
        businessName: " Lumen ",
        language: "sk",
      })
    ).toEqual({
      email: "a@b.cz",
      message: "Hi",
      businessName: "Lumen",
      language: "sk",
    })
  })

  test("rejects an email that is not one", () => {
    expect(
      ContactMessageSchema.safeParse({
        email: "not-an-email",
        language: "en",
      }).success
    ).toBe(false)
  })
})
