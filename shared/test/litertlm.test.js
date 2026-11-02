import { test } from "node:test";
import assert from "node:assert/strict";
import { parseVersions, kotlinOf, canRead, newestReadable, compareVersions } from "../../tools/lib/litertlm.mjs";

const META = `<metadata><groupId>g</groupId><artifactId>a</artifactId><versioning><latest>0.18.0</latest><versions>
<version>0.9.0</version><version>0.10.0</version><version>0.18.0</version></versions></versioning></metadata>`;
const pom = (kotlin) => `<project><dependencies>
<dependency><groupId>androidx.core</groupId><artifactId>core</artifactId><version>1.0</version></dependency>
<dependency><groupId>org.jetbrains.kotlin</groupId><artifactId>kotlin-stdlib</artifactId><version>${kotlin}</version><scope>runtime</scope></dependency>
</dependencies></project>`;

test("release list and the Kotlin each release was built with", () => {
  assert.deepEqual(parseVersions(META), ["0.9.0", "0.10.0", "0.18.0"]);
  assert.equal(kotlinOf(pom("2.4.0")), "2.4.0");
  assert.equal(kotlinOf(pom("2.1.0")), "2.1.0");
  assert.equal(kotlinOf("<project/>"), null);
  assert.equal(kotlinOf("<dependency><groupId>org.jetbrains.kotlin</groupId><artifactId>kotlin-stdlib-jdk8</artifactId><version>1.9.22</version></dependency>"), "1.9.22");
});

test("a Kotlin 2.1 compiler reads 2.1 and 2.2 libraries, not 2.3 or 2.4", () => {
  assert.deepEqual(["2.0.21", "2.1.0", "2.1.20", "2.2.0", "2.2.20", "2.3.0", "2.4.0"].map((k) => canRead("2.1.20", k)), [true, true, true, true, true, false, false]);
  assert.equal(canRead("2.1.20", null), null);
  assert.equal(canRead("2.1.20", "1.9.22"), true);
});

test("numeric version order and picking the newest readable release", () => {
  assert.deepEqual(["0.18.0", "0.9.0", "0.10.0"].sort(compareVersions), ["0.9.0", "0.10.0", "0.18.0"]);
  const rows = [{ version: "0.9.0", kotlin: "2.1.0" }, { version: "0.10.0", kotlin: "2.2.0" }, { version: "0.12.0", kotlin: "2.3.0" }, { version: "0.18.0", kotlin: "2.4.0" }, { version: "0.1.0", kotlin: null }];
  assert.equal(newestReadable(rows, "2.1.20").version, "0.10.0");
  assert.equal(newestReadable([{ version: "0.18.0", kotlin: "2.4.0" }], "2.1.20"), null);
});
