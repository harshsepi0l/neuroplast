/**
 * Short session titles. A session starts with a title made from the
 * learner's first message — filler stripped, first sentence kept, a few
 * words long — and the prober may replace it with a 2–5 word topic name
 * once the warm-up ends (unless the learner renamed it).
 */

export const MAX_TITLE_CHARS = 40;

/** Request phrasing that says nothing about the topic. */
const FILLER = [
	/^(can|could|would|will) you (please )?(help me )?(teach|explain|show|walk) (me )?(through |about )?/i,
	/^(please )?(teach|explain|show)( me\b)?( about\b)?\s*/i,
	/^(help me|i want to|i'd like to|i would like to|i need to) (understand|learn|study|get|know|review) (about |more about )?/i,
	/^(what|who) (is|are) /i,
	/^how (do|does|to) /i,
];

function cap(text: string): string {
	if (text.length <= MAX_TITLE_CHARS) return text;
	const cut = text.lastIndexOf(" ", MAX_TITLE_CHARS);
	return text.slice(0, cut > 12 ? cut : MAX_TITLE_CHARS).replace(/[,;:\-–—\s]+$/, "");
}

/** A short title from the learner's first message. */
export function shortTitle(prompt: string): string {
	let text = prompt.replace(/\[Attached [^\]]*\]/g, " ").replace(/\s+/g, " ").trim();
	text = text.replace(/^(hi|hey|hello)\b[,!.\s]*/i, "");
	text = text.split(/(?<=[?.!])\s/)[0] ?? text; // first sentence only
	text = text.replace(/[?.!…]+$/, "").trim();
	for (const pattern of FILLER) text = text.replace(pattern, "");
	text = text.replace(/^(the|a|an) /i, "").trim();
	if (!text) return "Untitled session";
	return cap(text.charAt(0).toUpperCase() + text.slice(1));
}

/** The prober's suggested topic name, cleaned; null when unusable. */
export function topicTitle(raw: string | undefined): string | null {
	const text = (raw ?? "").replace(/["“”*_`#]/g, "").replace(/\s+/g, " ").trim().replace(/[.?!]+$/, "");
	if (!text) return null;
	return cap(text);
}
