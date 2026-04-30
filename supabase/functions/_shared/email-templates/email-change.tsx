/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface EmailChangeEmailProps {
  siteName: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({
  siteName,
  email,
  newEmail,
  confirmationUrl,
}: EmailChangeEmailProps) => (
  <Html lang="sq" dir="ltr">
    <Head />
    <Preview>Konfirmo ndryshimin e email-it për Papirun</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={brandBar}>
          <Heading style={brand}>Papirun®</Heading>
          <Text style={tagline}>House of Crunch!</Text>
        </Section>

        <Heading style={h1}>Konfirmo ndryshimin e email-it ✉️</Heading>
        <Text style={text}>
          Ke kërkuar të ndryshosh adresën tënde të email-it për <strong>Papirun</strong> nga{' '}
          <Link href={`mailto:${email}`} style={link}>{email}</Link>{' '}
          në{' '}
          <Link href={`mailto:${newEmail}`} style={link}>{newEmail}</Link>.
        </Text>

        <Section style={buttonWrap}>
          <Button style={button} href={confirmationUrl}>
            Konfirmo ndryshimin
          </Button>
        </Section>

        <Text style={textMuted}>
          Click the button above to confirm your new email address.
        </Text>

        <Text style={footer}>
          Nëse nuk e ke kërkuar këtë ndryshim, sigurojë llogarinë tënde menjëherë.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default EmailChangeEmail

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
  margin: '0 0 20px',
}
const textMuted = {
  fontSize: '13px',
  color: '#6b7268',
  lineHeight: '1.5',
  margin: '24px 0 0',
  fontStyle: 'italic' as const,
}
const link = { color: '#5a8061', textDecoration: 'underline' }
const buttonWrap = { margin: '28px 0' }
const button = {
  backgroundColor: '#9DC0A0',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: '600' as const,
  borderRadius: '16px',
  padding: '14px 28px',
  textDecoration: 'none',
  display: 'inline-block',
}
const footer = {
  fontSize: '12px',
  color: '#9aa19c',
  margin: '36px 0 0',
  borderTop: '1px solid #eef2ee',
  paddingTop: '16px',
}
