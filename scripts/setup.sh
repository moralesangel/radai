#!/usr/bin/env bash
# One-shot setup for a fresh deploy of radai to your own Firebase project.
#
# What this does NOT do (still manual, both one-time and unavoidable):
#   - Creating the Firebase project itself (or picking an existing one)
#   - Upgrading that project to the Blaze plan
#   - Getting an Anthropic API key with billing set up
# Everything else -- linking the project, creating the web app, writing
# your .env, prompting for the secret -- is automated below.
set -euo pipefail

command -v firebase >/dev/null 2>&1 || {
  echo "firebase-tools is not installed. Run: npm install -g firebase-tools"
  exit 1
}

echo "== radai setup =="
echo

read -rp "Firebase project ID (from console.firebase.google.com, must be on the Blaze plan): " PROJECT_ID
[ -n "$PROJECT_ID" ] || { echo "A project ID is required."; exit 1; }

echo "{ \"projects\": { \"default\": \"$PROJECT_ID\" } }" > .firebaserc
firebase use "$PROJECT_ID"

echo
echo "-- Looking for an existing web app in this project --"
EXISTING_APP_ID=$(firebase apps:list WEB --project "$PROJECT_ID" 2>/dev/null \
  | grep -oE '1:[0-9]+:web:[a-f0-9]+' | head -n1 || true)

if [ -n "$EXISTING_APP_ID" ]; then
  APP_ID="$EXISTING_APP_ID"
  echo "Found existing web app: $APP_ID"
else
  echo "No web app found -- creating one named 'radai'..."
  firebase apps:create web radai --project "$PROJECT_ID"
  APP_ID=$(firebase apps:list WEB --project "$PROJECT_ID" 2>/dev/null \
    | grep -oE '1:[0-9]+:web:[a-f0-9]+' | head -n1)
fi
[ -n "$APP_ID" ] || { echo "Could not determine the web app ID."; exit 1; }

echo
echo "-- Fetching web app config --"
CONFIG_JSON=$(firebase apps:sdkconfig WEB "$APP_ID" --project "$PROJECT_ID" 2>/dev/null \
  | sed -n '/^{/,/^}/p')

get() { echo "$CONFIG_JSON" | grep -oE "\"$1\": *\"[^\"]*\"" | sed -E "s/.*\"([^\"]*)\"\$/\1/"; }

cat > .env <<EOF
VITE_FIREBASE_API_KEY=$(get apiKey)
VITE_FIREBASE_AUTH_DOMAIN=$(get authDomain)
VITE_FIREBASE_PROJECT_ID=$(get projectId)
VITE_FIREBASE_STORAGE_BUCKET=$(get storageBucket)
VITE_FIREBASE_MESSAGING_SENDER_ID=$(get messagingSenderId)
VITE_FIREBASE_APP_ID=$(get appId)
VITE_USE_EMULATOR=false
EOF
echo "Wrote .env"

echo
echo "-- Anthropic API key --"
echo "Get one at https://console.anthropic.com/settings/keys"
echo "(Needs its own billing at console.anthropic.com/settings/billing --"
echo " a claude.ai Pro/Max subscription does NOT cover API usage.)"
echo
firebase functions:secrets:set ANTHROPIC_API_KEY --project "$PROJECT_ID"

echo
echo "-- Restricting access to your Google account --"
echo "There's no login screen bypass: this app only works for one Google"
echo "account, checked server-side on every request."
read -rp "Your Google account's email (the one you'll sign in with): " OWNER_EMAIL
[ -n "$OWNER_EMAIL" ] || { echo "An email is required."; exit 1; }
echo "ALLOWED_EMAIL=$OWNER_EMAIL" > functions/.env
echo "Wrote functions/.env"

echo
echo "-- Enable Google Sign-In --"
echo "One manual step (no full CLI equivalent for first-time setup):"
echo "  1. Open https://console.firebase.google.com/project/$PROJECT_ID/authentication"
echo "  2. Click 'Get started' if this is the project's first auth provider"
echo "  3. Enable the 'Google' sign-in provider and save"
read -rp "Press Enter once you've done that... " _

echo
echo "== Setup complete. Next: =="
echo "  npm install && (cd functions && npm install)"
echo "  npm run build && (cd functions && npm run build)"
echo "  firebase deploy --project $PROJECT_ID"
