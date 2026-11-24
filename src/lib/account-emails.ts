/**
 * Plain account-security emails. Each says what happened, to which account, and
 * what to do if it was not the owner. No dashes, no marketing.
 */
const SUPPORT = 'hi@bylineseo.com'

export const EMAIL_CHANGE_REQUESTED_MESSAGE =
  'If that address can be used, a confirmation link is on its way to it. Your email stays as it is until you use that link. If nothing arrives within a few minutes, the address may already be in use on another account, so try a different one.'


const wrap = (inner: string) =>
  `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#1c1a17;max-width:480px">${inner}<p>Byline<br>bylineseo.com</p></div>`
const button = (href: string, label: string) =>
  `<p><a href="${href}" style="display:inline-block;background:#B87333;color:#1c1a17;text-decoration:none;font-weight:bold;padding:10px 18px;border-radius:6px">${label}</a></p>`

export function passwordChangedEmail(origin: string): { subject: string; text: string; html: string } {
  const reset = `${origin}/forgot-password`
  return {
    subject: 'Your Byline password was changed',
    text: [
      'Hello,',
      '',
      'The password for your Byline account was just changed, and every other signed-in session was ended.',
      '',
      `If that was you, nothing more is needed. If it was not you, someone else has access to your account: reset your password now at ${reset} and write to ${SUPPORT} so it can be looked at straight away.`,
      '',
      'Byline',
      'bylineseo.com',
    ].join('\n'),
    html: wrap(
      `<p>Hello,</p><p>The password for your Byline account was just changed, and every other signed-in session was ended.</p><p>If that was you, nothing more is needed. If it was not you, someone else has access to your account. Reset your password now and write to <a href="mailto:${SUPPORT}">${SUPPORT}</a> so it can be looked at straight away.</p>${button(reset, 'Reset my password')}`,
    ),
  }
}

/** To the NEW address: confirm, and nothing changes until this is used. */
export function emailChangeConfirmEmail(link: string): { subject: string; text: string; html: string } {
  return {
    subject: 'Confirm your new email address for Byline',
    text: [
      'Hello,',
      '',
      'Someone asked to use this email address for a Byline account. Nothing has changed yet. To confirm the change, open this link:',
      '',
      link,
      '',
      'The link works once and expires in one hour. If you did not ask for this, ignore the email: nothing will change.',
      '',
      'Byline',
      'bylineseo.com',
    ].join('\n'),
    html: wrap(
      `<p>Hello,</p><p>Someone asked to use this email address for a Byline account. Nothing has changed yet. To confirm the change, use the button below.</p>${button(link, 'Confirm this address')}<p>Or paste this link into your browser:<br><a href="${link}" style="color:#7a4a1c;word-break:break-all">${link}</a></p><p>The link works once and expires in one hour. If you did not ask for this, ignore the email: nothing will change.</p>`,
    ),
  }
}

/** To the OLD address when a change is requested: the owner's warning, with a way to object. */
export function emailChangeRequestedEmail(newEmail: string, cancelLink: string, origin: string): { subject: string; text: string; html: string } {
  const reset = `${origin}/forgot-password`
  return {
    subject: 'Someone asked to change the email on your Byline account',
    text: [
      'Hello,',
      '',
      `A request was made to change the email address on your Byline account to ${newEmail}. Nothing has changed yet: this address stays your sign-in until the new one is confirmed.`,
      '',
      'If this was you, you do not need to do anything.',
      '',
      'If it was not you, cancel it now:',
      cancelLink,
      '',
      `Then reset your password at ${reset}, which ends every other session, and write to ${SUPPORT} so it can be looked at straight away.`,
      '',
      'Byline',
      'bylineseo.com',
    ].join('\n'),
    html: wrap(
      `<p>Hello,</p><p>A request was made to change the email address on your Byline account to <strong>${newEmail}</strong>. Nothing has changed yet: this address stays your sign-in until the new one is confirmed.</p><p>If this was you, you do not need to do anything.</p><p>If it was not you, cancel it now.</p>${button(cancelLink, 'Cancel this change')}<p>Then <a href="${reset}" style="color:#7a4a1c">reset your password</a>, which ends every other session, and write to <a href="mailto:${SUPPORT}">${SUPPORT}</a> so it can be looked at straight away.</p>`,
    ),
  }
}

/** To the OLD address once the switch has happened. */
export function emailChangedEmail(newEmail: string): { subject: string; text: string; html: string } {
  return {
    subject: 'The email on your Byline account was changed',
    text: [
      'Hello,',
      '',
      `The email address on your Byline account was changed to ${newEmail}. This address no longer signs in to that account.`,
      '',
      `If that was you, nothing more is needed. If it was not you, write to ${SUPPORT} straight away, from this address, and say so. The change can be reversed and the account secured.`,
      '',
      'Byline',
      'bylineseo.com',
    ].join('\n'),
    html: wrap(
      `<p>Hello,</p><p>The email address on your Byline account was changed to <strong>${newEmail}</strong>. This address no longer signs in to that account.</p><p>If that was you, nothing more is needed. If it was not you, write to <a href="mailto:${SUPPORT}">${SUPPORT}</a> straight away, from this address, and say so. The change can be reversed and the account secured.</p>`,
    ),
  }
}
