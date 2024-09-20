#!/bin/bash

# if [ -z "$TESTER_PRIMARY_GOOGLE_ACCT" ]; then
#   echo "Error: TESTER_PRIMARY_GOOGLE_ACCT is not set: export TESTER_PRIMARY_GOOGLE_ACCT=\"your@gmail.com\""
#   exit 1
# fi

# if [ -z "$TESTER_SECONDARY_EMAIL_ACCT" ]; then
#   echo "Error: TESTER_SECONDARY_EMAIL_ACCT is not set: export TESTER_SECONDARY_EMAIL_ACCT=\"anotherEmailAddressThatYouUse@anything.com\""
#   exit 1
# fi

# If emulator didn't shut down cleanly last time, try:
# lsof -ti :8085 | xargs kill
# lsof -ti :8085 | xargs kill
# lsof -ti :4500 | xargs kill
# lsof -ti :4400 | xargs kill
# lsof -ti :5000 | xargs kill
# lsof -ti :8080 | xargs kill
export LOG_LEVEL=WARN
echo "Starting firebase emulator"
firebase emulators:start > /dev/stdout &
#firebase emulators:start > /dev/null 2>&1 &
LOGS_PID=$!
sleep 10

echo "running tests"
cd functions
# Export LOG_LEVEL environment variable

mocha test/00.util.test.js  --exit --bail --reporter spec || TEST_FAILED=true
mocha test/01.init.test.js  --exit --bail --reporter spec || TEST_FAILED=true
mocha test/02.graph.test.js  --exit --bail --reporter spec || TEST_FAILED=true
# mocha test/03.stability.test.js --bail --reporter spec || TEST_FAILED=true
mocha test/04.queue.test.js  --exit --bail --reporter spec || TEST_FAILED=true
mocha test/05.sharp.test.js  --exit --bail --reporter spec || TEST_FAILED=true
mocha test/06.carousel.test.js --exit --bail --reporter spec || TEST_FAILED=true
mocha test/07.aax.test.js --exit --bail --reporter spec || TEST_FAILED=true

# Stop the logs stream
kill $LOGS_PID

# Exit with error if tests failed
if [ "$TEST_FAILED" = true ]; then
    exit 1
fi
sleep 10