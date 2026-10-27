/**
 * Filter option lists and helpers for the Search page's filter mode
 * (see `pages/SearchPage.jsx` and the backend `/api/series-filter` endpoint).
 * Values are what the backend accepts; labels are the user-facing text.
 */

/**
 * @typedef {Object} FilterOption
 * @property {string} value value sent to the backend (e.g. genre id / country name)
 * @property {string} label user-facing text
 */

/** Value meaning "no filter" for both genre and country selects. */
export const ALL_VALUE = 'all';

/** @type {FilterOption[]} */
export const GENRES = [
    { value: 'all', label: 'Любой жанр' },
    { value: '19', label: 'Discovery&BBC' },
    { value: '1', label: 'анимационные' },
    { value: '18', label: 'аниме' },
    { value: '5', label: 'боевики' },
    { value: '6', label: 'детективы' },
    { value: '13', label: 'документальные' },
    { value: '8', label: 'драмы' },
    { value: '14', label: 'исторические' },
    { value: '17', label: 'комедия' },
    { value: '9', label: 'криминальные' },
    { value: '4', label: 'мелодрамы' },
    { value: '15', label: 'мистические' },
    { value: '10', label: 'отечественные' },
    { value: '11', label: 'приключения' },
    { value: '20', label: 'реалити-шоу' },
    { value: '12', label: 'семейные' },
    { value: '21', label: 'театр' },
    { value: '16', label: 'триллеры' },
    { value: '7', label: 'ужасы' },
    { value: '2', label: 'фантастические' },
    { value: '3', label: 'фэнтези' },
];

/** @type {FilterOption[]} */
export const COUNTRIES = [
    { value: 'all', label: 'Любая страна' },
    { value: 'Австралия', label: 'Австралия' },
    { value: 'Австрия', label: 'Австрия' },
    { value: 'Азербайджан', label: 'Азербайджан' },
    { value: 'Аргентина', label: 'Аргентина' },
    { value: 'Армения', label: 'Армения' },
    { value: 'Бангладеш', label: 'Бангладеш' },
    { value: 'Беларусь', label: 'Беларусь' },
    { value: 'Белиз', label: 'Белиз' },
    { value: 'Бельгия', label: 'Бельгия' },
    { value: 'Болгария', label: 'Болгария' },
    { value: 'Босния и Герцеговина', label: 'Босния и Герцеговина' },
    { value: 'Бразилия', label: 'Бразилия' },
    { value: 'Великобритания', label: 'Великобритания' },
    { value: 'Венгрия', label: 'Венгрия' },
    { value: 'Венесуэла', label: 'Венесуэла' },
    { value: 'Вьетнам', label: 'Вьетнам' },
    { value: 'Гватемала', label: 'Гватемала' },
    { value: 'Германия', label: 'Германия' },
    { value: 'Голландия', label: 'Голландия' },
    { value: 'Гонконг', label: 'Гонконг' },
    { value: 'Греция', label: 'Греция' },
    { value: 'Грузия', label: 'Грузия' },
    { value: 'Дания', label: 'Дания' },
    { value: 'Доминика', label: 'Доминика' },
    { value: 'Доминикана', label: 'Доминикана' },
    { value: 'Египет', label: 'Египет' },
    { value: 'Израиль', label: 'Израиль' },
    { value: 'Индия', label: 'Индия' },
    { value: 'Индонезия', label: 'Индонезия' },
    { value: 'Иордания', label: 'Иордания' },
    { value: 'Ирак', label: 'Ирак' },
    { value: 'Иран', label: 'Иран' },
    { value: 'Ирландия', label: 'Ирландия' },
    { value: 'Исландия', label: 'Исландия' },
    { value: 'Испания', label: 'Испания' },
    { value: 'Италия', label: 'Италия' },
    { value: 'Казахстан', label: 'Казахстан' },
    { value: 'Камерун', label: 'Камерун' },
    { value: 'Канада', label: 'Канада' },
    { value: 'Катар', label: 'Катар' },
    { value: 'Кения', label: 'Кения' },
    { value: 'Кипр', label: 'Кипр' },
    { value: 'Китай', label: 'Китай' },
    { value: 'Колумбия', label: 'Колумбия' },
    { value: 'Корея Северная', label: 'Корея Северная' },
    { value: 'Корея Южная', label: 'Корея Южная' },
    { value: 'Коста-Рика', label: 'Коста-Рика' },
    { value: 'Куба', label: 'Куба' },
    { value: 'Кувейт', label: 'Кувейт' },
    { value: 'Кыргызстан', label: 'Кыргызстан' },
    { value: 'Латвия', label: 'Латвия' },
    { value: 'Ливан', label: 'Ливан' },
    { value: 'Литва', label: 'Литва' },
    { value: 'Люксембург', label: 'Люксембург' },
    { value: 'Малайзия', label: 'Малайзия' },
    { value: 'Мальта', label: 'Мальта' },
    { value: 'Марокко', label: 'Марокко' },
    { value: 'Мексикa', label: 'Мексикa' },
    { value: 'Мексика', label: 'Мексика' },
    { value: 'Молдова', label: 'Молдова' },
    { value: 'Монголия', label: 'Монголия' },
    { value: 'Нигерия', label: 'Нигерия' },
    { value: 'Нидерланды', label: 'Нидерланды' },
    { value: 'Новая Зеландия', label: 'Новая Зеландия' },
    { value: 'Норвегия', label: 'Норвегия' },
    { value: 'ОАЭ', label: 'ОАЭ' },
    { value: 'Оман', label: 'Оман' },
    { value: 'Пакистан', label: 'Пакистан' },
    { value: 'Перу', label: 'Перу' },
    { value: 'Польша', label: 'Польша' },
    { value: 'Португалия', label: 'Португалия' },
    { value: 'Пуэрто Рико', label: 'Пуэрто Рико' },
    { value: 'Россия', label: 'Россия' },
    { value: 'Румыния', label: 'Румыния' },
    { value: 'Саудовская Аравия', label: 'Саудовская Аравия' },
    { value: 'Сербия', label: 'Сербия' },
    { value: 'Сингапур', label: 'Сингапур' },
    { value: 'Сирия', label: 'Сирия' },
    { value: 'Словакия', label: 'Словакия' },
    { value: 'Словения', label: 'Словения' },
    { value: 'СССР', label: 'СССР' },
    { value: 'Судан', label: 'Судан' },
    { value: 'США', label: 'США' },
    { value: 'Таиланд', label: 'Таиланд' },
    { value: 'Тайвань', label: 'Тайвань' },
    { value: 'Тунис', label: 'Тунис' },
    { value: 'Турция', label: 'Турция' },
    { value: 'Узбекистан', label: 'Узбекистан' },
    { value: 'Украина', label: 'Украина' },
    { value: 'Уругвай', label: 'Уругвай' },
    { value: 'Филиппины', label: 'Филиппины' },
    { value: 'Финляндия', label: 'Финляндия' },
    { value: 'Франция', label: 'Франция' },
    { value: 'ФРГ', label: 'ФРГ' },
    { value: 'Хорватия', label: 'Хорватия' },
    { value: 'Черногория', label: 'Черногория' },
    { value: 'Чехия', label: 'Чехия' },
    { value: 'Чехословакия', label: 'Чехословакия' },
    { value: 'Чили', label: 'Чили' },
    { value: 'Швейцария', label: 'Швейцария' },
    { value: 'Швеция', label: 'Швеция' },
    { value: 'Шотландия', label: 'Шотландия' },
    { value: 'Эстония', label: 'Эстония' },
    { value: 'ЮАР', label: 'ЮАР' },
    { value: 'Югославия', label: 'Югославия' },
    { value: 'Япония', label: 'Япония' },
];

/**
 * Normalize a raw select value: null/undefined/whitespace become
 * `ALL_VALUE`, anything else is trimmed.
 * @param {string | null | undefined} value
 * @returns {string}
 */
export function normalizeFilterValue(value) {
    const v = String(value ?? '').trim();
    return v || ALL_VALUE;
}

/**
 * Build the query-string part for the series-filter API from a genre id and a
 * country name. `all` values are omitted (the backend then returns the whole
 * catalog). Returns '' when no filter is active.
 * @param {string | null | undefined} genre
 * @param {string | null | undefined} country
 * @returns {string} e.g. `?filter_quotG=19&filter_quotC=%D0%A1%D0%A8%D0%90`
 */
export function buildFilterApiQuery(genre, country) {
    const params = [];
    const g = normalizeFilterValue(genre);
    const c = normalizeFilterValue(country);
    if (g !== ALL_VALUE) params.push(`filter_quotG=${encodeURIComponent(g)}`);
    if (c !== ALL_VALUE) params.push(`filter_quotC=${encodeURIComponent(c)}`);
    return params.length ? `?${params.join('&')}` : '';
}
