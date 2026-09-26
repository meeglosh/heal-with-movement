import {test} from 'node:test';
import assert from 'node:assert/strict';
import {types} from '@neondatabase/serverless';
import '../server/db.js';
test('Neon DATE parser preserves child birth dates independently of timezone',()=>{
 assert.equal(types.getTypeParser(types.builtins.DATE)('2020-01-01'),'2020-01-01');
 assert.equal(types.getTypeParser(types.builtins.TIMESTAMPTZ)('2026-09-28 14:00:00+00').toISOString(),'2026-09-28T14:00:00.000Z');
});
