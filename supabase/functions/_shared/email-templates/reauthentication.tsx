/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="sq" dir="ltr">
    <Head />
    <Preview>Kodi yt i verifikimit për Papirun</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={brandBar}>
          <Heading style={brand}>Papirun®</Heading>
          <Text style={tagline}>House of Crunch!</Text>
        </Section>

        <Heading style={h1}>Konfirmo identitetin 🔐</Heading>
        <Text style={text}>Përdor kodin më poshtë për të konfirmuar identitetin tënd:</Text>

        <Section style={codeWrap}>
          <Text style={codeStyle}>{token}</Text>
        </Section>

        <Text style={textMuted}>
          Use the code above to confirm your identity. It will expire shortly.
        </Text>

        <Text style={footer}>
          Nëse nuk e ke kërkuar këtë, injoroje këtë mesazh.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail

const main = {
  backgroundColor: '#ffffff',
  fontFamily: '"DM Sans", "Poppins", Arial, sans-serif',
}
const container = { padding: '32px 28px', maxWidth: '560px' }
const brandBar = {
  borderBottom: '2px solid #9DC0A0',
  paddingBottom: '16px',
  marginBottom: '28px',
}
const brand = {
  fontFamily: '"Poppins", Arial, sans-serif',
  fontSize: '26px',
  fontWeight: 'bold' as const,
  color: '#5a8061',
  margin: '0',
  letterSpacing: '-0.5px',
}
const tagline = {
  fontSize: '12px',
  color: '#9DC0A0',
  margin: '4px 0 0',
  fontWeight: '500' as const,
  letterSpacing: '0.5px',
  textTransform: 'uppercase' as const,
}
const h1 = {
  fontSize: '24px',
  fontWeight: 'bold' as const,
  color: '#1f2620',
  margin: '0 0 16px',
}
const text = {
  fontSize: '15px',
  color: '#3c423d',
  lineHeight: '1.6',
  margin: '0 0 16px',
}
const textMuted = {
  fontSize: '13px',
  color: '#6b7268',
  lineHeight: '1.5',
  margin: '20px 0 0',
  fontStyle: 'italic' as const,
}
const codeWrap = {
  backgroundColor: '#f4f9f6',
  borderRadius: '16px',
  padding: '20px',
  textAlign: 'center' as const,
  margin: '8px 0 24px',
}
const codeStyle = {
  fontFamily: '"Courier New", Courier, monospace',
  fontSize: '32px',
  fontWeight: 'bold' as const,
  color: '#5a8061',
  margin: '0',
  letterSpacing: '8px',
}
const footer = {
  fontSize: '12px',
  color: '#9aa19c',
  margin: '36px 0 0',
  borderTop: '1px solid #eef2ee',
  paddingTop: '16px',
}
