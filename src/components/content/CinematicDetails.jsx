import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { FiCheck, FiChevronLeft, FiChevronRight, FiHeart, FiMoreHorizontal, FiPlay, FiPlus, FiThumbsDown } from "react-icons/fi";

const img = (path, size = "w780") => path ? `https://image.tmdb.org/t/p/${size}${path}` : null;
const Pill = ({ children }) => <span className="rounded-full border border-white/[0.16] bg-black/15 px-3 py-1 text-[11px] text-white/70">{children}</span>;
const RoundAction = ({ icon, label, active, onClick }) => <button type="button" onClick={onClick} className="group flex min-w-[58px] flex-col items-center gap-1.5 text-[11px] text-white/75 hover:text-white"><span className={`grid h-11 w-11 place-items-center rounded-full border transition ${active ? "border-red-500 bg-red-600 text-white" : "border-white/35 bg-black/20 group-hover:border-white/60 group-hover:bg-white/[0.08]"}`}>{icon}</span>{label}</button>;

export default function CinematicDetails({ media, type, cast = [], backdrops = [], reviews = [], recommendations = [], status, favourite, onFavourite, onStatus, onTrailer, trailerUrl, onCloseTrailer }) {
  const [tab, setTab] = useState("overview");
  const [more, setMore] = useState(false);
  const title = media.title || media.name;
  const date = media.release_date || media.first_air_date || "";
  const runtime = type === "movie" ? (media.runtime ? `${Math.floor(media.runtime / 60)}h ${media.runtime % 60}m` : null) : (media.number_of_seasons ? `${media.number_of_seasons} Seasons` : null);
  const score = Math.round(Number(media.vote_average || 0) * 10);
  const certification = useMemo(() => {
    if (type === "movie") return media.release_dates?.results?.find((x) => x.iso_3166_1 === "US")?.release_dates?.find((x) => x.certification)?.certification || null;
    return media.content_ratings?.results?.find((x) => x.iso_3166_1 === "US")?.rating || null;
  }, [media, type]);
  const keywords = (media.keywords?.keywords || media.keywords?.results || []).slice(0, 6);
  const watch = () => document.getElementById("watch-tab")?.click();
  const tabs = ["overview", "cast & crew", "similar", "details", "reviews"];

  return <div className="relative min-h-screen overflow-hidden bg-[#08090b] text-white">
    {trailerUrl && <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm" onClick={onCloseTrailer}><div className="w-full max-w-5xl rounded-xl border border-white/15 bg-[#101115] p-3" onClick={(event) => event.stopPropagation()}><div className="mb-3 flex items-center justify-between px-1"><h2 className="text-xl">{title} Trailer</h2><button onClick={onCloseTrailer} className="rounded-full border border-white/20 px-4 py-1.5 text-[12px]">Close</button></div><iframe className="aspect-video w-full rounded-lg" src={trailerUrl} title={`${title} trailer`} allowFullScreen /></div></div>}
    {media.backdrop_path && <img src={img(media.backdrop_path, "original")} alt="" className="fixed inset-x-0 top-16 h-[calc(100vh-4rem)] w-full object-cover" />}
    <div className="fixed inset-x-0 top-16 h-[calc(100vh-4rem)] bg-gradient-to-r from-black/90 via-black/55 to-black/20" />
    <div className="fixed inset-x-0 top-16 h-[calc(100vh-4rem)] bg-gradient-to-t from-[#08090b]/95 via-transparent to-black/30" />
    <section className="relative min-h-[570px] border-b border-white/[0.08] bg-black/10 backdrop-blur-[2px]">
      <div className="relative z-10 mx-auto flex min-h-[570px] max-w-[1500px] items-center px-5 pb-14 pt-10 md:px-10 lg:px-12">
        <div className="max-w-[535px]">
          <p className="mb-2 text-[13px] text-white/70">{(media.genres || []).slice(0, 2).map((g) => g.name).join("  >  ")}</p>
          <h1 className="text-5xl font-black leading-[0.95] tracking-[-0.04em] drop-shadow-2xl sm:text-6xl lg:text-[64px]">{title}</h1>
          <div className="mt-5 flex flex-wrap items-center gap-4 text-[13px]">{score > 0 && <span className="font-semibold text-emerald-400">{score}% Match</span>}<span>{date.slice(0, 4) || "TBA"}</span>{certification && <span className="rounded border border-white/40 px-1.5">{certification}</span>}{runtime && <span>{runtime}</span>}<span className="rounded border border-white/40 px-1.5">HD</span></div>
          <p className="mt-4 text-[14px] leading-[1.55] text-white/85">{media.overview}</p>
          <div className="mt-6 flex flex-wrap items-start gap-4">
            <button onClick={watch} className="flex h-10 min-w-[202px] items-center justify-center gap-3 rounded-[6px] bg-white px-6 text-[13px] font-bold text-black transition hover:bg-[#dedede]"><FiPlay fill="currentColor" />{status === "Watching" || status === "Finished" ? "Resume Watching" : "Watch Now"}</button>
            <RoundAction icon={status ? <FiCheck size={21} /> : <FiPlus size={21} />} label="My List" active={Boolean(status)} onClick={() => onStatus(status ? null : "Want to Watch")} />
            <RoundAction icon={<FiHeart size={19} />} label="Like" active={favourite} onClick={onFavourite} />
            <RoundAction icon={<FiThumbsDown size={19} />} label="Not for Me" active={status === "Dropped"} onClick={() => onStatus("Dropped")} />
            <div className="relative"><RoundAction icon={<FiMoreHorizontal size={22} />} label="More" onClick={() => setMore(!more)} />{more && <div className="absolute left-1/2 top-14 z-30 w-40 -translate-x-1/2 rounded-lg border border-white/15 bg-[#15171b] py-1 shadow-2xl">{["Want to Watch", "Watching", "Finished", "Paused", "Dropped"].map((value) => <button key={value} onClick={() => { onStatus(value); setMore(false); }} className="block w-full px-4 py-2 text-left text-[12px] hover:bg-white/10">{value}</button>)}</div>}</div>
          </div>
        </div>
      </div>
    </section>
    <main className="relative z-20 mx-auto -mt-12 max-w-[1500px] border-t border-white/[0.12] bg-[#080a0d]/70 px-5 pb-16 pt-4 shadow-[0_-18px_70px_rgba(0,0,0,0.25)] backdrop-blur-2xl md:px-10 lg:px-12">
      <nav className="flex gap-8 overflow-x-auto border-b border-white/15 text-[14px] text-white/60">{tabs.map((value) => <button key={value} onClick={() => setTab(value)} className={`relative shrink-0 pb-3 capitalize ${tab === value ? "font-semibold text-white after:absolute after:bottom-0 after:left-0 after:h-[3px] after:w-full after:bg-red-600" : ""}`}>{value}</button>)}</nav>
      {tab === "overview" && <>
        <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-6">{backdrops.slice(0, 5).map((shot, i) => <button key={shot.file_path} onClick={i === 0 ? onTrailer : undefined} className="group relative h-32 overflow-hidden rounded-[7px] border border-white/[0.18] bg-[#111318]"><img src={img(shot.file_path, "w500")} alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" />{i === 0 && <span className="absolute inset-0 flex items-end bg-gradient-to-t from-black/90 p-3 text-left text-[14px]"><span className="mr-2 grid h-9 w-9 place-items-center rounded-full border border-white/70"><FiPlay /></span>Play Trailer</span>}</button>)}<div className="col-span-2 flex h-32 flex-col justify-center rounded-[7px] border border-white/[0.18] bg-[#111318]/80 px-6 backdrop-blur-xl xl:col-span-1"><p className="line-clamp-3 text-[17px] leading-6">"{reviews[0]?.content?.slice(0, 110) || "A memorable title worth adding to your watchlist."}"</p><span className="mt-3 h-[3px] w-10 bg-red-600" /><small className="mt-2 text-white/45">{reviews[0]?.author || "Audience review"}</small></div></div>
        <div className="mt-6 grid gap-6 lg:grid-cols-[1.45fr_1fr]">
          <section><div className="mb-3 flex justify-between"><h2 className="text-xl">Cast & Crew</h2><button onClick={() => setTab("cast & crew")} className="text-[12px] text-white/50">View All -&gt;</button></div><div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">{cast.slice(0, 5).map((p) => <Link to={`/person/${p.id}`} key={p._castKey || p.credit_id || p.id} className="flex min-w-0 items-center gap-3"><div className="h-16 w-16 shrink-0 overflow-hidden rounded-full border border-white/20 bg-white/5">{p.profile_path && <img src={img(p.profile_path, "w185")} alt="" className="h-full w-full object-cover" />}</div><div className="min-w-0"><p className="truncate text-[13px]">{p.name}</p><p className="truncate text-[11px] text-white/45">{p.character}</p></div></Link>)}</div></section>
          <section className="lg:border-l lg:border-white/10 lg:pl-6"><h3>Genres</h3><div className="mt-2 flex flex-wrap gap-2">{(media.genres || []).map((g) => <Pill key={g.id}>{g.name}</Pill>)}</div><div className="mt-4 grid grid-cols-2 gap-4"><div><h3>Mood</h3><div className="mt-2 flex flex-wrap gap-2">{keywords.slice(0, 3).map((k) => <Pill key={k.id}>{k.name}</Pill>)}</div></div><div><h3>Themes</h3><div className="mt-2 flex flex-wrap gap-2">{keywords.slice(3).map((k) => <Pill key={k.id}>{k.name}</Pill>)}</div></div></div></section>
        </div>
        <Similar items={recommendations} type={type} />
      </>}
      {tab === "cast & crew" && <div className="mt-6 grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">{cast.slice(0, 18).map((p) => <Link to={`/person/${p.id}`} key={p._castKey || p.credit_id || p.id}><div className="aspect-[3/4] overflow-hidden rounded-lg bg-white/5">{p.profile_path && <img src={img(p.profile_path, "w342")} alt="" className="h-full w-full object-cover" />}</div><p className="mt-2 text-[14px]">{p.name}</p><p className="text-[11px] text-white/45">{p.character}</p></Link>)}</div>}
      {tab === "similar" && <Similar items={recommendations} type={type} expanded />}
      {tab === "details" && <div className="mt-6 grid gap-px overflow-hidden rounded-xl border border-white/10 bg-white/10 sm:grid-cols-2">{[["Status", media.status], ["Original language", media.original_language], ["Release", date], [type === "movie" ? "Runtime" : "Episodes", type === "movie" ? runtime : media.number_of_episodes]].map(([key, value]) => <div key={key} className="bg-[#101115] p-5"><small className="text-white/40">{key}</small><p>{value || "N/A"}</p></div>)}</div>}
      {tab === "reviews" && <div className="mt-6 grid gap-4 md:grid-cols-2">{reviews.slice(0, 8).map((r) => <article key={r.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-5"><h3>{r.author}</h3><p className="mt-3 line-clamp-6 text-[13px] leading-6 text-white/60">{r.content}</p></article>)}</div>}
    </main>
  </div>;
}

function Similar({ items, type, expanded }) {
  const railRef = useRef(null);
  const slide = (direction) => railRef.current?.scrollBy({ left: direction * Math.max(520, railRef.current.clientWidth * 0.72), behavior: "smooth" });
  if (expanded) return <section className="mt-7"><h2 className="mb-3 text-[21px] font-semibold">More Like This</h2><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{items.slice(0, 20).map((item) => <SimilarCard key={item.id} item={item} type={type} />)}</div></section>;
  return <section className="relative mt-7"><div className="mb-3 flex items-center justify-between"><h2 className="text-[21px] font-semibold">More Like This</h2><div className="flex gap-2"><button type="button" onClick={() => slide(-1)} aria-label="Previous titles" className="grid h-8 w-8 place-items-center rounded-full border border-white/20 bg-black/25 text-white/75 transition hover:border-white/45 hover:bg-white/10 hover:text-white"><FiChevronLeft size={18} /></button><button type="button" onClick={() => slide(1)} aria-label="Next titles" className="grid h-8 w-8 place-items-center rounded-full border border-white/20 bg-black/25 text-white/75 transition hover:border-white/45 hover:bg-white/10 hover:text-white"><FiChevronRight size={18} /></button></div></div><div ref={railRef} className="hide-scrollbar grid snap-x snap-mandatory grid-flow-col auto-cols-[190px] gap-3 overflow-x-auto scroll-smooth pb-1 sm:auto-cols-[220px]">{items.slice(0, 20).map((item) => <SimilarCard key={item.id} item={item} type={type} />)}</div></section>;
}

function SimilarCard({ item, type }) {
  return <Link to={`/${type === "movie" ? "movies" : "shows"}/${item.id}`} className="group min-w-0 snap-start"><div className="aspect-video overflow-hidden rounded-[5px] border border-white/[0.12] bg-[#111318]">{(item.backdrop_path || item.poster_path) && <img src={img(item.backdrop_path || item.poster_path, "w500")} alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.035]" />}</div><p className="mt-2 truncate text-[12px] text-white/90">{item.title || item.name}</p></Link>;
}
