import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
const rulesSource = fs.readFileSync(rulesPath, 'utf8');

test('firestore.rules uses rules_version 2 and default-deny global safety net', () => {
  assert.match(rulesSource, /rules_version\s*=\s*'2';/);
  assert.match(rulesSource, /match\s+\/\{document=\*\*\}\s*\{\s*allow read, write:\s*if false;\s*\}/);
});

test('firestore.rules restricts /users/{userId}/logs/{date} to verified owner and validates schema', () => {
  assert.match(rulesSource, /match \/users\/\{userId\}\/logs\/\{date\}/);
  assert.match(rulesSource, /allow get:\s*if isValidId\(userId\) && isValidDateStr\(date\) && isOwner\(userId\);/);
  assert.match(rulesSource, /allow list:\s*if isSignedIn\(\) && isOwner\(userId\) && resource\.data\.userId == request\.auth\.uid;/);
  assert.match(rulesSource, /allow create:\s*if isVerified\(\)/);
  assert.match(rulesSource, /allow update:\s*if isVerified\(\)/);
  assert.match(rulesSource, /isValidDailyFoodLog\(incoming\(\), userId, date\)/);
  assert.match(rulesSource, /affectedKeys\(\)\.hasOnly\(\['items', 'updatedAt'\]\)/);
  assert.match(rulesSource, /entry\.sugar is number && entry\.sugar >= 0 && entry\.sugar <= 5000/);
  assert.match(rulesSource, /data\.updatedAt == request\.time/);
  assert.match(rulesSource, /data\.items\.size\(\) <= 100/);
});
