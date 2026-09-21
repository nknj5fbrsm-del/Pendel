import assert from "node:assert/strict";
import { encodeMidi, noteNameToMidi, pitchFromAngle } from "../dist/audio/midi.js";

assert.equal(noteNameToMidi("C4"), 60);
assert.equal(noteNameToMidi("A4"), 69);
assert.equal(noteNameToMidi("D#3"), 51);

const low = pitchFromAngle(0, ["C4", "E4", "G4"]);
const high = pitchFromAngle(Math.PI * 1.9, ["C4", "E4", "G4"]);
assert.equal(low, 60);
assert.equal(high, 67);

const emptyish = encodeMidi([]);
const header = String.fromCharCode(...emptyish.slice(0, 4));
assert.equal(header, "MThd");
assert.equal(emptyish[9], 1, "format 1");

const withNotes = encodeMidi([
  { timeSec: 0, durationSec: 0.5, midi: 60, channel: 0, velocity: 80, program: 0 },
  { timeSec: 0.25, durationSec: 0.1, midi: 36, channel: 9, velocity: 100 },
]);
assert.equal(String.fromCharCode(...withNotes.slice(0, 4)), "MThd");
assert.ok(withNotes.length > emptyish.length);
assert.ok(withNotes.includes(0x90) || withNotes.includes(0x99));

console.log("midi tests ok");
