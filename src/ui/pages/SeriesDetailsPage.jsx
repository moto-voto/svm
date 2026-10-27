import { createSignal, createEffect, onMount, Show } from 'solid-js';
import { useSearchParams, A } from '@solidjs/router';
import { fetchSeriesDetails } from '../api.js';
import { loadSeriesProgress } from '../watch-progress.js';
import { isBookmarked, saveBookmark, removeBookmark } from '../bookmarks.js';
import { invalidateBookmarksState } from '../bookmarks-state.js';
import Header from '../components/Header.jsx';
import { normalizeImageUrl, buildPosterFallback, formatSeasonsLabel, formatRating, buildPlayerHref, resolveBackHref } from '../series-details.js';

/** @import { SeriesDetails } from '../../parser/series-details.js' */

export default function SeriesDetailsPage() {
    const [searchParams] = useSearchParams();
    const seriesUrl = String(searchParams.url || '');
    // Origin of the visit ("history") so the back button returns to the page
    // the user actually came from instead of always the main search.
    const fromParam = String(searchParams.from || '');

    const [details, setDetails] = createSignal(
        /** @type {SeriesDetails | null} */ (null)
    );
    const [loading, setLoading] = createSignal(true);
    const [error, setError] = createSignal(/** @type {string | null} */ (null));
    const [posterSrc, setPosterSrc] = createSignal('');
    const [lastSeasonLink, setLastSeasonLink] = createSignal('');
    const [bookmarked, setBookmarked] = createSignal(false);
    const [bookmarkBusy, setBookmarkBusy] = createSignal(false);

    /**
     * Stable identity used for the bookmark record — same rules as the watch
     * progress key: the serial id when available, otherwise the series URL.
     */
    const bookmarksSeriesId = () => (details()?.idSerial || details()?.fullLink || seriesUrl);

    /**
     * Toggle the series' bookmark, then drop the bookmarks page's in-memory
     * snapshot so the next visit re-reads IndexedDB (the listing changed).
     */
    async function toggleBookmark() {
        if (bookmarkBusy()) return;
        const seriesId = bookmarksSeriesId();
        if (!seriesId) return;
        setBookmarkBusy(true);
        try {
            if (bookmarked()) {
                await removeBookmark(seriesId);
                setBookmarked(false);
            } else {
                await saveBookmark(seriesId, {
                    title: details()?.title,
                    image: normalizeImageUrl(details()?.image || '') || null,
                    fullLink: details()?.fullLink || seriesUrl,
                });
                setBookmarked(true);
            }
            invalidateBookmarksState();
        } finally {
            setBookmarkBusy(false);
        }
    }

    onMount(async () => {
        if (!seriesUrl) {
            setError('Series URL is required');
            setLoading(false);
            return;
        }
        try {
            const loaded = await fetchSeriesDetails(seriesUrl);
            setDetails(loaded);
            // Resume the player on the series' last played season.
            const playerUrl = loaded?.fullLink || seriesUrl;
            const seriesId = loaded?.idSerial || playerUrl;
            if (seriesId) {
                const record = await loadSeriesProgress(seriesId);
                setLastSeasonLink(record?.lastSeasonLink || '');
                setBookmarked(Boolean(await isBookmarked(seriesId)));
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setLoading(false);
        }
    });

    // Keep the poster in sync with the loaded data (and normalize protocol-relative URLs).
    createEffect(() => {
        const image = details()?.image;
        if (image) {
            setPosterSrc(normalizeImageUrl(image));
        }
    });

    const fallbackPoster = () => buildPosterFallback(details()?.title);

    return (
        <div class="min-h-screen flex flex-col justify-between bg-[#0d0d0e] text-gray-200 selection:bg-brand-orange selection:text-black">
            <div>
                <Header
                    maxWidth="max-w-4xl"
                    topRight={
                        <Show when={details()}>
                            <button
                                type="button"
                                onClick={toggleBookmark}
                                disabled={bookmarkBusy()}
                                title={bookmarked() ? 'Убрать из закладок' : 'Добавить в закладки'}
                                class="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold px-3 py-1.5 rounded-full border transition-colors whitespace-nowrap disabled:opacity-60"
                                classList={{
                                    'bg-brand-orange/15 text-brand-orange border-brand-orange/40': bookmarked(),
                                    'bg-[#222226] text-gray-300 border-neutral-700/60 hover:bg-[#2c2c32] hover:text-white': !bookmarked(),
                                }}
                            >
                                <i class={`fa-solid ${bookmarked() ? 'fa-bookmark' : 'fa-bookmark-regular'} text-xs sm:text-sm`}></i>
                                <span>{bookmarked() ? 'В закладках' : 'В закладки'}</span>
                            </button>
                        </Show>
                    }
                >
                    {/* Back to list + primary watch action, pinned while scrolling */}
                    <div class="flex items-center justify-between gap-3">
                        <A
                            href={resolveBackHref(fromParam)}
                            noScroll
                            class="inline-flex items-center gap-2 bg-[#222226] hover:bg-[#2c2c32] text-white hover:text-brand-orange text-sm font-semibold px-4 py-2.5 rounded-lg border border-brand-cardBorder transition-all duration-200 active:scale-95 shadow-sm shrink-0"
                        >
                            <i class="fa-solid fa-arrow-left text-brand-orange"></i>
                            <span>Назад к списку</span>
                        </A>

                        <Show
                            when={details()?.fullLink}
                            fallback={
                                <span class="inline-flex items-center gap-2 bg-brand-orange/50 text-black/60 font-bold text-sm py-2.5 px-4 rounded-lg cursor-not-allowed shrink-0">
                                    <i class="fa-solid fa-play text-black/60 text-sm"></i>
                                    <span>Смотреть онлайн</span>
                                </span>
                            }
                        >
                            <A
                                href={buildPlayerHref(
                                    details()?.fullLink || seriesUrl,
                                    lastSeasonLink(),
                                    details()?.title,
                                    normalizeImageUrl(details()?.image || ''),
                                    fromParam
                                )}
                                class="inline-flex items-center gap-2 bg-brand-orange hover:bg-brand-orangeDark text-black font-bold text-sm py-2.5 px-4 rounded-lg shadow-lg transition-all duration-200 active:scale-95 shrink-0"
                            >
                                <i class="fa-solid fa-play text-black text-sm"></i>
                                <span>Смотреть онлайн</span>
                                <i class="fa-solid fa-chevron-right text-xs opacity-75 ml-1"></i>
                            </A>
                        </Show>
                    </div>
                </Header>

                <main class="max-w-4xl mx-auto px-4 py-5 md:py-8">
                    <Show when={loading()}>
                        <div class="py-24 flex flex-col items-center justify-center text-brand-textMuted">
                            <div class="w-12 h-12 border-4 border-brand-orange/20 border-t-brand-orange rounded-full animate-spin mb-3"></div>
                            <p class="text-sm">Загрузка информации...</p>
                        </div>
                    </Show>

                    <Show when={!loading() && error()}>
                        <div class="bg-red-900/40 border border-red-700 text-red-200 p-5 rounded-xl text-center">{error()}</div>
                    </Show>

                    <Show when={!loading() && !error() && details()}>
                        {/* Title & Original Title */}
                        <div>
                            <h1 class="text-xl sm:text-2xl md:text-3xl font-extrabold text-white leading-tight mb-1">
                                {details()?.title || '—'}
                            </h1>
                            <p class="text-brand-orange text-sm sm:text-base font-semibold flex items-center gap-2">
                                <i class="fa-solid fa-film text-xs"></i>
                                {details()?.originalName || '—'}
                            </p>
                        </div>

                        {/* Single Series Main Card */}
                        <div class="bg-brand-cardBg border border-brand-cardBorder rounded-2xl p-4 sm:p-6 shadow-2xl overflow-hidden relative">
                            {/* Card Header Tagline */}
                            <div class="flex flex-wrap items-center gap-2 mb-4 pb-3 border-b border-brand-cardBorder">
                                <Show when={details()?.seasons}>
                                    <span class="bg-brand-orange text-black font-extrabold text-xs px-2.5 py-1 rounded uppercase tracking-wider">
                                        {details()?.seasons} Сезон
                                    </span>
                                </Show>
                                <Show when={details()?.year}>
                                    <span class="bg-[#282830] text-gray-300 text-xs px-2.5 py-1 rounded font-medium">
                                        {details()?.year} год
                                    </span>
                                </Show>
                                <Show when={details()?.genre}>
                                    <span class="bg-[#282830] text-gray-300 text-xs px-2.5 py-1 rounded font-medium">
                                        {details()?.genre}
                                    </span>
                                </Show>
                            </div>

                            {/* Main Grid Layout: Poster Left, Details Right */}
                            <div class="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                                {/* Left Column: Poster & Primary Actions */}
                                <div class="md:col-span-4 flex flex-col items-center">
                                    <div class="relative w-full max-w-[280px] md:max-w-none aspect-[2/3] rounded-xl overflow-hidden border border-brand-cardBorder shadow-lg group bg-[#111113]">
                                        <img
                                            src={posterSrc() || fallbackPoster()}
                                            alt="Обложка сериала"
                                            class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                            onError={(event) => {
                                                event.currentTarget.onerror = null;
                                                setPosterSrc(fallbackPoster());
                                            }}
                                        />
                                        <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60"></div>

                                        {/* Badges over Poster */}
                                        <div class="absolute bottom-3 left-3 right-3 flex justify-between items-center">
                                            <span class="bg-black/75 backdrop-blur-md text-brand-orange text-xs font-bold px-2.5 py-1 rounded border border-brand-orange/30">
                                                IMDb {formatRating(details()?.imdb)}
                                            </span>
                                            <span class="bg-black/75 backdrop-blur-md text-gray-300 text-xs font-bold px-2.5 py-1 rounded border border-white/10">
                                                КП {formatRating(details()?.kinopoisk)}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Right Column: Structured Field Details */}
                                <div class="md:col-span-8 space-y-4">

                                    {/* Description Box */}
                                    <div class="bg-[#121214] rounded-xl border border-brand-cardBorder p-4">
                                        <h3 class="text-xs font-bold uppercase tracking-wider text-brand-orange mb-2 flex items-center gap-2">
                                            <i class="fa-solid fa-align-left"></i> Описание сериала
                                        </h3>
                                        <p class="text-gray-200 text-base sm:text-lg leading-relaxed font-normal">
                                            {details()?.description || 'Описание отсутствует.'}
                                        </p>
                                    </div>

                                    {/* Field Item List (Key / Value Pairs) */}
                                    <div class="bg-[#121214] rounded-xl border border-brand-cardBorder divide-y divide-[#222228] text-xs sm:text-sm">
                                        <div class="p-3 sm:px-4 flex justify-between items-center">
                                            <span class="text-brand-textMuted font-medium flex items-center gap-2">
                                                <i class="fa-solid fa-calendar text-xs text-brand-orange w-4"></i> Год выпуска
                                            </span>
                                            <span class="text-white font-semibold">{details()?.year || '—'}</span>
                                        </div>

                                        <div class="p-3 sm:px-4 flex justify-between items-center">
                                            <span class="text-brand-textMuted font-medium flex items-center gap-2">
                                                <i class="fa-solid fa-layer-group text-xs text-brand-orange w-4"></i> Количество сезонов
                                            </span>
                                            <span class="text-white font-semibold">
                                                {formatSeasonsLabel(details()?.seasons)}
                                            </span>
                                        </div>

                                        <div class="p-3 sm:px-4 flex justify-between items-center">
                                            <span class="text-brand-textMuted font-medium flex items-center gap-2">
                                                <i class="fa-solid fa-earth-americas text-xs text-brand-orange w-4"></i> Страна / Категории
                                            </span>
                                            <span class="text-white font-semibold text-right">{details()?.country || '—'}</span>
                                        </div>

                                        <div class="p-3 sm:px-4 flex justify-between items-center">
                                            <span class="text-brand-textMuted font-medium flex items-center gap-2">
                                                <i class="fa-solid fa-masks-theater text-xs text-brand-orange w-4"></i> Жанр
                                            </span>
                                            <span class="text-white font-semibold text-right">{details()?.genre || '—'}</span>
                                        </div>

                                        <div class="p-3 sm:px-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
                                            <span class="text-brand-textMuted font-medium flex items-center gap-2">
                                                <i class="fa-solid fa-link text-xs text-brand-orange w-4"></i> Прямая ссылка
                                            </span>
                                            <Show
                                                when={details()?.fullLink}
                                                fallback={<span class="text-brand-textMuted text-xs">—</span>}
                                            >
                                                <a
                                                    href={details()?.fullLink}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    class="text-brand-orange hover:underline text-xs truncate max-w-full sm:max-w-[280px]"
                                                >
                                                    {details()?.fullLink}
                                                </a>
                                            </Show>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Show>
                </main>
            </div>

            {/* Footer */}
            <footer class="mt-8 py-4 border-t border-brand-cardBorder text-center text-xs text-brand-textMuted bg-[#111113]">
                <div class="max-w-4xl mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-2">
                    <div>© SeasonVar Mobile (svm) 2026</div>
                    <div class="text-brand-orange font-medium">svm on MotorHeat</div>
                </div>
            </footer>
        </div>
    );
}
