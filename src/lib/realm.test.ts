/**
 * Testes do mapa type → realm e do parse de Host.
 * Executar: npx tsx src/lib/realm.test.ts
 */
import assert from "node:assert/strict";
import {
  getRealmForOrgType,
  isHubHost,
  orgTypeBelongsToRealm,
  realmEntryUrl,
  resolveRealmFromHost,
  REALM_ORG_TYPES,
} from "./realm";

assert.equal(getRealmForOrgType("capitulo"), "odm");
assert.equal(getRealmForOrgType("alumni"), "odm");
assert.equal(getRealmForOrgType("castelo"), "odm");
assert.equal(getRealmForOrgType("priorado"), "odm");
assert.equal(getRealmForOrgType("bethel"), "fdj");
assert.equal(getRealmForOrgType("loja"), "loja");
assert.equal(getRealmForOrgType("arco_iris"), null);
assert.equal(getRealmForOrgType("apj"), null);
assert.equal(getRealmForOrgType("outro"), null);
assert.equal(getRealmForOrgType(null), null);
assert.equal(getRealmForOrgType("desconhecido"), null);

assert.ok(orgTypeBelongsToRealm("capitulo", "odm"));
assert.ok(!orgTypeBelongsToRealm("loja", "odm"));
assert.ok(REALM_ORG_TYPES.odm.includes("capitulo"));
assert.ok(REALM_ORG_TYPES.loja.includes("loja"));

assert.equal(resolveRealmFromHost("odm.templovirtual.app"), "odm");
assert.equal(resolveRealmFromHost("fdj.templovirtual.app:443"), "fdj");
assert.equal(resolveRealmFromHost("loja.templovirtual.app"), "loja");
assert.equal(resolveRealmFromHost("lodge.templovirtual.app"), "loja");
assert.equal(resolveRealmFromHost("templovirtual.app"), null);
assert.equal(resolveRealmFromHost("www.templovirtual.app"), null);
assert.equal(resolveRealmFromHost("localhost"), null);
assert.equal(resolveRealmFromHost("localhost", "odm"), "odm");
assert.equal(resolveRealmFromHost("127.0.0.1", "fdj"), "fdj");
assert.equal(resolveRealmFromHost("odm.localhost", "fdj"), "odm");
assert.ok(isHubHost("templovirtual.app"));
assert.ok(!isHubHost("odm.templovirtual.app"));
assert.ok(!isHubHost("loja.templovirtual.app"));

assert.equal(realmEntryUrl("odm"), "https://odm.templovirtual.app/inicio");
assert.equal(realmEntryUrl("loja"), "https://loja.templovirtual.app/inicio");

console.log("realm.test.ts ok");
