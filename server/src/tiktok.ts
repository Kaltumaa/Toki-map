// TikTok's public oEmbed endpoint. No auth, no app registration.
// Gives us title, author and a thumbnail for any public video URL.
//
// Why not the Saved/Favourites feed: TikTok's Display API does not expose a
// user's private saved collection, so "paste a link" is the honest MVP.

export type TikTokMeta = {
  title: string | null;
  author: string | null;
  thumbnailUrl: string | null;
};

export async function fetchTikTokMeta(videoUrl: string): Promise<TikTokMeta> {
  const empty: TikTokMeta = { title: null, author: null, thumbnailUrl: null };

  try {
    const url = new URL("https://www.tiktok.com/oembed");
    url.searchParams.set("url", videoUrl);

    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return empty;

    const data = (await res.json()) as {
      title?: string;
      author_name?: string;
      thumbnail_url?: string;
    };

    return {
      title: data.title ?? null,
      author: data.author_name ?? null,
      thumbnailUrl: data.thumbnail_url ?? null,
    };
  } catch {
    // A dead or private link shouldn't block saving the place.
    return empty;
  }
}