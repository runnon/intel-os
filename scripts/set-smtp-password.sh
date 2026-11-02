#!/bin/zsh
# One-time: point Supabase's sign-in emails at Gmail (supabase/config.toml [auth.email.smtp]).
# Prompts for the Gmail app password without echoing it; it is passed straight to
# `supabase config push` and never written to disk or the repo.
cd "${0:A:h}/.." || exit 1

echo "1. Create a Gmail app password for xakkahn2001@gmail.com (name it \"Theater Picture\")."
echo "   Opening https://myaccount.google.com/apppasswords in your browser..."
open "https://myaccount.google.com/apppasswords"
echo
printf '2. Paste the 16-letter app password here and press Enter (it will not show): '
read -rs pw
echo
pw=${pw// /}
if [[ ${#pw} -ne 16 ]]; then
  echo "That isn't 16 letters. Run this again and paste the app password Google showed."
  exit 1
fi

echo "Saving to Supabase..."
SUPABASE_AUTH_SMTP_PASS=$pw supabase config push --project-ref huhrdcxvdgmuvdgwymdj <<< y 2>&1 \
  | grep -viE "pass|new version|recommend updating|^\{"
unset pw
echo
echo "Done. You can close this tab."
