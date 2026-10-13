// Per-character community links. Fill these in by slug (see characters list for slugs).
// Only add links you've verified: Discord invites expire and get replaced.
export interface CommunityLinks {
  discord?: string;
  highlights?: { title: string; url: string }[];
}

export const community: Record<string, CommunityLinks> = {
  // example:
  // lucas: {
  //   discord: 'https://discord.gg/xxxxxxx',
  //   highlights: [{ title: 'Some combo video', url: 'https://www.youtube.com/watch?v=...' }],
  // },
};

export const youtubeSearch = (q: string) =>
  `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
