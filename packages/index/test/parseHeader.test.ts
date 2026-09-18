import { test } from "node:test";
import assert from "node:assert/strict";
import { parseHeader } from "../src/parseHeader.ts";

const rst = `::

  ZIP: 0
  Title: ZIP Process
  Owners: Jack Grigg <thestr4d@gmail.com>
          Arya <arya@zfnd.org>
  Status: Active
  Category: Process
  Created: 2019-02-16
  License: BSD-2-Clause

Terminology
===========
`;

const md = `    ZIP: 229
    Title: Version 6 Transaction Format
    Owners: Daira-Emma Hopwood <daira@jacaranda.org>
    Status: Draft
    Category: Consensus
    Created: 2026-06-13
    License: MIT
    Discussions-To: <https://github.com/zcash/zips/issues/1326>
    Requires: 224, 225

# Terminology
`;

test("parses RST :: header", () => {
  const h = parseHeader(rst);
  assert.equal(h.number, 0);
  assert.equal(h.title, "ZIP Process");
  assert.equal(h.statusRaw, "Active");
  assert.equal(h.category, "Process");
  assert.equal(h.created, "2019-02-16");
  assert.equal(h.owners.length, 2);
  assert.equal(h.owners[0].email, "thestr4d@gmail.com");
});

test("parses indented markdown header and Discussions-To", () => {
  const h = parseHeader(md);
  assert.equal(h.number, 229);
  assert.equal(h.discussionsTo, "https://github.com/zcash/zips/issues/1326");
  assert.deepEqual(h.requires, [224, 225]);
});

test("missing Title warns, does not throw", () => {
  const h = parseHeader("::\n\n  ZIP: 1\n  Status: Draft\n");
  assert.equal(h.number, 1);
  assert.equal(h.title, "");
  assert.ok(h.warnings.some((w) => /title/i.test(w)));
});
