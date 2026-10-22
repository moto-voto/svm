import { createSignal, createEffect, onMount, onCleanup, Show } from 'solid-js';
import { useSearchParams, A } from '@solidjs/router';
import { fetchSeriesDetails } from '../api.js';

export default function SeriesDetailsPage() {
    const [searchParams] = useSearchParams();
    const seriesUrl = String(searchParams.url || '');

    const [details, setDetails] = createSignal(
        /** @type {import('../../parser/series-details.js').SeriesDetails | null} */ (null)
    );
    const [loading, setLoading] = createSignal(true);
    const [error, setError] = createSignal(/** @type {string | null} */ (null));
    const [jsonOpen, setJsonOpen] = createSignal(false);
    const [toast, setToast] = createSignal(/** @type {string | null} */ (null));
    const [posterSrc, setPosterSrc] = createSignal('');

    /** @type {ReturnType<typeof setTimeout> | undefined} */
    let toastTimeout;

    const showToast = (message) => {
        setToast(message);
        clearTimeout(toastTimeout);
        toastTimeout = setTimeout(() => setToast(null), 3000);
    };

    onMount(async () => {
        if (!seriesUrl) {
            setError('Series URL is required');
            setLoading(false);
            return;
        }
        try {
            setDetails(await fetchSeriesDetails(seriesUrl));
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setLoading(false);
        }
    });

    onCleanup(() => clearTimeout(toastTimeout));

    // Keep the poster in sync with the loaded data (and normalize protocol-relative URLs).
    createEffect(() => {
        const image = details()?.image;
        if (image) {
            setPosterSrc(image.startsWith('//') ? `https:${image}` : image);
        }
    });

    const fallbackPoster = () => {
        const title = details()?.title || 'Series';
        return `https://placehold.co/400x600/1e1e24/ff9900?text=${encodeURIComponent(title)}`;
    };

    const copyJson = async () => {
        const text = JSON.stringify(details(), null, 2);
        try {
            await navigator.clipboard.writeText(text);
        } catch {
            // Clipboard fallback for older/unsupported browsers.
            const textarea = document.createElement('textarea');
            textarea.value = text;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
        }
        showToast('JSON успешно скопирован в буфер обмена!');
    };

    return (
        <div class="min-h-screen flex flex-col justify-between bg-[#0d0d0e] text-gray-200 selection:bg-brand-orange selection:text-black">
            <div>
                {/* Top Navigation Bar */}
                <header class="bg-[#141416] border-b border-brand-cardBorder sticky top-0 z-50 shadow-md">
                    <div class="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
                        <div class="flex items-center space-x-3">
                            <span class="text-brand-orange font-bold text-lg md:text-xl tracking-tight flex items-center gap-2">
                                <i class="fa-solid font-black fa-play-circle text-brand-orange"></i>
                                Seasonvar
                                <span class="text-xs bg-brand-orange/20 text-brand-orange px-2 py-0.5 rounded font-semibold uppercase tracking-wider">Mobile</span>
                            </span>
                        </div>
                        <div class="text-xs text-brand-textMuted bg-[#1d1d21] px-3 py-1.5 rounded-md border border-brand-cardBorder">
                            <span class="text-brand-orange font-medium">ID:</span> {details()?.id || '—'}
                        </div>
                    </div>
                </header>

                <main class="max-w-4xl mx-auto px-4 py-5 md:py-8">
                    {/* Back / JSON actions */}
                    <div class="mb-5 flex items-center justify-between">
                        <A
                            href="/"
                            class="inline-flex items-center gap-2 bg-[#222226] hover:bg-[#2c2c32] text-white hover:text-brand-orange text-sm font-semibold px-4 py-2.5 rounded-lg border border-brand-cardBorder transition-all duration-200 active:scale-95 shadow-sm"
                        >
                            <i class="fa-solid fa-arrow-left text-brand-orange"></i>
                            <span>Назад к списку</span>
                        </A>

                        <button
                            type="button"
                            onClick={() => setJsonOpen((open) => !open)}
                            class="inline-flex items-center gap-1.5 bg-[#1a1a1d] hover:bg-[#242428] text-brand-textMuted hover:text-white text-xs font-medium px-3 py-2 rounded-lg border border-brand-cardBorder transition-all"
                        >
                            <i class="fa-solid fa-code text-brand-orange"></i>
                            <span>{jsonOpen() ? 'Скрыть JSON' : 'JSON Модель'}</span>
                        </button>
                    </div>

                    {/* JSON Preview Collapsible Panel */}
                    <Show when={jsonOpen()}>
                        <div class="mb-6 bg-[#121214] border border-brand-orange/30 rounded-xl p-4 shadow-inner relative overflow-hidden">
                            <div class="flex justify-between items-center mb-2 pb-2 border-b border-brand-cardBorder">
                                <span class="text-xs font-mono text-brand-orange font-semibold flex items-center gap-1.5">
                                    <i class="fa-solid fa-file-code"></i> Исходная модель JSON
                                </span>
                                <button
                                    type="button"
                                    onClick={copyJson}
                                    class="text-xs text-brand-textMuted hover:text-white bg-[#222226] px-2.5 py-1 rounded border border-brand-cardBorder transition-colors"
                                >
                                    <i class="fa-regular fa-copy mr-1"></i> Копировать
                                </button>
                            </div>
                            <pre class="font-mono text-xs text-green-400 overflow-x-auto p-2 bg-[#09090a] rounded border border-[#1f1f22] leading-relaxed">{JSON.stringify(details(), null, 2)}</pre>
                        </div>
                    </Show>

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
                                                IMDb {details()?.imdb || 'Н/Д'}
                                            </span>
                                            <span class="bg-black/75 backdrop-blur-md text-gray-300 text-xs font-bold px-2.5 py-1 rounded border border-white/10">
                                                КП {details()?.kinopoisk || 'Н/Д'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Full Link External Watch Button */}
                                    <Show
                                        when={details()?.fullLink}
                                        fallback={
                                            <span class="w-full max-w-[280px] md:max-w-none mt-4 bg-brand-orange/50 text-black/60 font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 cursor-not-allowed">
                                                <i class="fa-solid fa-play text-black/60 text-sm"></i>
                                                <span>Смотреть онлайн</span>
                                            </span>
                                        }
                                    >
                                        <a
                                            href={details()?.fullLink}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            class="w-full max-w-[280px] md:max-w-none mt-4 bg-brand-orange hover:bg-brand-orangeDark text-black font-bold py-3 px-4 rounded-xl shadow-lg transition-all duration-200 flex items-center justify-center gap-2 active:scale-98"
                                        >
                                            <i class="fa-solid fa-play text-black text-sm"></i>
                                            <span>Смотреть онлайн</span>
                                            <i class="fa-solid fa-arrow-up-right-from-square text-xs opacity-75 ml-1"></i>
                                        </a>
                                    </Show>
                                </div>

                                {/* Right Column: Structured Field Details */}
                                <div class="md:col-span-8 space-y-4">
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

                                    {/* Description Box */}
                                    <div class="bg-[#121214] rounded-xl border border-brand-cardBorder p-4">
                                        <h3 class="text-xs font-bold uppercase tracking-wider text-brand-orange mb-2 flex items-center gap-2">
                                            <i class="fa-solid fa-align-left"></i> Описание сериала
                                        </h3>
                                        <p class="text-gray-300 text-xs sm:text-sm leading-relaxed font-normal">
                                            {details()?.description || 'Описание отсутствует.'}
                                        </p>
                                    </div>

                                    {/* Rating Cards Row */}
                                    <div class="grid grid-cols-2 gap-3 py-2">
                                        <div class="bg-[#121214] border border-brand-cardBorder p-3 rounded-xl flex items-center gap-3">
                                            <div class="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 font-black text-lg">
                                                <i class="fa-brands fa-imdb"></i>
                                            </div>
                                            <div>
                                                <div class="text-[11px] text-brand-textMuted uppercase font-medium">IMDb Рейтинг</div>
                                                <div class="text-base font-bold text-white">{details()?.imdb || 'Н/Д'}</div>
                                            </div>
                                        </div>

                                        <div class="bg-[#121214] border border-brand-cardBorder p-3 rounded-xl flex items-center gap-3">
                                            <div class="w-10 h-10 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400 font-black text-sm">
                                                КП
                                            </div>
                                            <div>
                                                <div class="text-[11px] text-brand-textMuted uppercase font-medium">Кинопоиск</div>
                                                <div class="text-base font-bold text-gray-400">{details()?.kinopoisk || 'Н/Д'}</div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Field Item List (Key / Value Pairs) */}
                                    <div class="bg-[#121214] rounded-xl border border-brand-cardBorder divide-y divide-[#222228] text-sm">
                                        <div class="p-3 sm:px-4 flex justify-between items-center">
                                            <span class="text-brand-textMuted font-medium flex items-center gap-2">
                                                <i class="fa-solid fa-hashtag text-xs text-brand-orange w-4"></i> ID Карточки
                                            </span>
                                            <span class="font-mono text-white bg-[#1e1e22] px-2 py-0.5 rounded border border-[#2a2a30] text-xs">
                                                {details()?.id || '—'}
                                            </span>
                                        </div>

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
                                                {details()?.seasons ? `${details()?.seasons} сезона` : '—'}
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

            {/* Toast notification */}
            <Show when={toast()}>
                <div class="fixed bottom-5 right-5 bg-brand-orange text-black font-semibold text-xs py-2.5 px-4 rounded-xl shadow-2xl z-50 flex items-center gap-2">
                    <i class="fa-solid fa-circle-check"></i>
                    <span>{toast()}</span>
                </div>
            </Show>
        </div>
    );
}
