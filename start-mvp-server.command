#!/bin/bash
# Doppelklick im Finder startet einen lokalen Webserver und öffnet Chrome.
# Ohne lokalen Server lehnt Chrome den Mikrofonzugriff ab (file://-Problem).

set -e
cd "$(dirname "$0")"

PORT=8765
URL="http://localhost:${PORT}/kanzlei-diktat.html"

# Falls Port belegt: nach oben zählen
while lsof -iTCP:${PORT} -sTCP:LISTEN -t >/dev/null 2>&1; do
  PORT=$((PORT+1))
  URL="http://localhost:${PORT}/kanzlei-diktat.html"
done

echo "Starte lokalen Webserver auf Port ${PORT} …"
echo "Öffne im Browser: ${URL}"
echo "Zum Beenden: Cmd+Q in diesem Fenster"
echo ""

# Chrome bevorzugen, sonst Standard-Browser
if [ -d "/Applications/Google Chrome.app" ]; then
  open -a "Google Chrome" "${URL}"
elif [ -d "/Applications/Microsoft Edge.app" ]; then
  open -a "Microsoft Edge" "${URL}"
else
  open "${URL}"
fi

# Server im Vordergrund (Schließen des Fensters beendet ihn)
python3 -m http.server "${PORT}"
