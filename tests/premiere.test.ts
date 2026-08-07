import { describe, expect, it } from "vitest";
import premiereData from "@/examples/demo_premiere.json";
import {
  buildPremiereRecap,
  clusterQuestions,
  detectSpikes,
  triageMessage,
  type ChatMessage,
} from "@/lib/premiere";

const CTX = { channelTitle: "Tech World", ownerChannelId: "UCdemo_techworld" };

function msg(author: string, text: string, atSeconds: number): ChatMessage {
  return { id: Math.random().toString(36).slice(2), author, text, atSeconds };
}

describe("triageMessage", () => {
  it("flags the WhatsApp impersonator as a scam with reasons", () => {
    const triaged = triageMessage(
      msg("𝗧𝗲𝗰𝗵 𝗪𝗼𝗿𝗹𝗱 ✔", "For investment tips message me on WhatsApp +44 7700 900123", 60),
      CTX
    );
    expect(triaged.kind).toBe("scam");
    expect(triaged.reasons.length).toBeGreaterThan(0);
  });

  it("labels real questions as questions", () => {
    expect(triageMessage(msg("@dev", "Is 16GB enough for docker?", 10), CTX).kind).toBe("question");
  });

  it("leaves ordinary hype as chat", () => {
    expect(triageMessage(msg("@fan", "lets gooo", 5), CTX).kind).toBe("chat");
    expect(triageMessage(msg("@fan", "ok?", 5), CTX).kind).toBe("chat");
  });

  it("never flags the actual creator", () => {
    const triaged = triageMessage(
      { ...msg("Tech World", "welcome everyone!", 2), authorChannelId: "UCdemo_techworld" },
      CTX
    );
    expect(triaged.kind).toBe("chat");
  });
});

describe("clusterQuestions", () => {
  it("merges rephrasings of the same question and counts askers", () => {
    const questions = [
      msg("@a", "is 16GB RAM enough for docker and vscode?", 10),
      msg("@b", "how much RAM do you need for docker on these?", 40),
      msg("@c", "does the fanless design throttle long compiles?", 70),
    ].map((m) => triageMessage(m, CTX));
    const clusters = clusterQuestions(questions);
    expect(clusters).toHaveLength(2);
    expect(clusters[0].count).toBe(2);
    expect(clusters[0].authors).toEqual(["@a", "@b"]);
  });
});

describe("detectSpikes", () => {
  it("finds a burst against the stream's own baseline", () => {
    const calm = Array.from({ length: 12 }, (_, i) => msg(`@v${i}`, "watching", i * 55));
    const burst = Array.from({ length: 6 }, (_, i) => msg(`@b${i}`, "CLIP THAT", 300 + i * 4));
    const spikes = detectSpikes([...calm, ...burst]);
    expect(spikes).toHaveLength(1);
    expect(spikes[0].atSeconds).toBe(300);
    expect(spikes[0].ratio).toBeGreaterThanOrEqual(2.5);
  });

  it("stays silent on a uniform stream", () => {
    const uniform = Array.from({ length: 24 }, (_, i) => msg(`@v${i}`, "hello", i * 30));
    expect(detectSpikes(uniform)).toEqual([]);
  });
});

describe("the bundled premiere chat", () => {
  const triaged = (premiereData.messages as ChatMessage[]).map((m) =>
    triageMessage(m, { channelTitle: premiereData.channel.title, ownerChannelId: premiereData.channel.channelId })
  );

  it("catches all three seeded scams and nothing else", () => {
    const scams = triaged.filter((t) => t.kind === "scam");
    expect(scams).toHaveLength(3);
    expect(scams.map((s) => s.author)).toContain("@fx_evelyn_trader");
  });

  it("finds the two engineered chat spikes for the recap", () => {
    const recap = buildPremiereRecap(triaged);
    expect(recap.spikes).toHaveLength(2);
    expect(recap.spikes.map((s) => s.atSeconds)).toEqual([300, 600]);
    expect(recap.clipNotes[0]).toContain("5:00");
    expect(recap.questions.length).toBeGreaterThan(3);
    expect(recap.questions[0].count).toBeGreaterThan(1);
  });
});
