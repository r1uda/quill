import { test } from "node:test";
import assert from "node:assert/strict";
import { voiceChoice } from "../src/domain/voiceGesture";
test("recording gesture selects during the hold and resets when moving back", () => {
  assert.equal(voiceChoice(0,0), "neutral");
  assert.equal(voiceChoice(90,2), "confirm");
  assert.equal(voiceChoice(-90,2), "edit");
  assert.equal(voiceChoice(15,2), "neutral");
  assert.equal(voiceChoice(0,-90), "cancel");
  assert.equal(voiceChoice(70,100), "neutral");
});
