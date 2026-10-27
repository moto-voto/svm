/**
 * Genre filter options.
 * @typedef {Object} GenreOption
 * @property {string} value genre ID
 * @property {string} text genre display text
 */

/**
 * Genre options matching the backend values.
 * @type {GenreOption[]}
 */
export const genreOptions = [
    { value: 'all', text: 'Любой жанр' },
    { value: '19', text: 'Discovery&amp;BBC' },
    { value: '1', text: 'анимационные' },
    { value: '18', text: 'аниме' },
    { value: '5', text: 'боевики' },
    { value: '6', text: 'детективы' },
    { value: '13', text: 'документальные' },
    { value: '8', text: 'драмы' },
    { value: '14', text: 'исторические' },
    { value: '17', text: 'комедия' },
    { value: '9', text: 'криминальные' },
    { value: '4', text: 'мелодрамы' },
    { value: '15', text: 'мистические' },
    { value: '10', text: 'отечественные' },
    { value: '11', text: 'приключения' },
    { value: '20', text: 'реалити-шоу' },
    { value: '12', text: 'семейные' },
    { value: '21', text: 'театр' },
    { value: '16', text: 'триллеры' },
    { value: '7', text: 'ужасы' },
    { value: '2', text: 'фантастические' },
    { value: '3', text: 'фэнтези' }
];

/**
 * Country filter options.
 * @typedef {Object} CountryOption
 * @property {string} value country code
 * @property {string} text country display text
 */

/**
 * Country options matching the backend values.
 * @type {CountryOption[]}
 */
export const countryOptions = [
    { value: 'all', text: 'Любая страна' },
    { value: 'Австралия', text: 'Австралия' },
    { value: 'Австрия', text: 'Австрия' },
    { value: 'Азербайджан', text: 'Азербайджан' },
    { value: 'Аргентина', text: 'Аргентина' },
    { value: 'Армения', text: 'Армения' },
    { value: 'Бангладеш', text: 'Бангладеш' },
    { value: 'Беларусь', text: 'Беларусь' },
    { value: 'Белиз', text: 'Белиз' },
    { value: 'Бельгия', text: 'Бельгия' },
    { value: 'Болгария', text: 'Болгария' },
    { value: 'Босния и Герцеговина', text: 'Босния и Герцеговина' },
    { value: 'Бразилия', text: 'Бразилия' },
    { value: 'Великобритания', text: 'Великобритания' },
    { value: 'Венгрия', text: 'Венгрия' },
    { value: 'Венесуэла', text: 'Венесуэла' },
    { value: 'Вьетнам', text: 'Вьетнам' },
    { value: 'Гватемала', text: 'Гватемала' },
    { value: 'Германия', text: 'Германия' },
    { value: 'Голландия', text: 'Голландия' },
    { value: 'Гонконг', text: 'Гонконг' },
    { value: 'Греция', text: 'Греция' },
    { value: 'Грузия', text: 'Грузия' },
    { value: 'Дания', text: 'Дания' },
    { value: 'Доминика', text: 'Доминика' },
    { value: 'Доминикана', text: 'Доминикана' },
    { value: 'Египет', text: 'Египет' },
    { value: 'Израиль', text: 'Израиль' },
    { value: 'Индия', text: 'Индия' },
    { value: 'Индонезия', text: 'Индонезия' },
    { value: 'Иордания', text: 'Иордания' },
    { value: 'Ирак', text: 'Ирак' },
    { value: 'Иран', text: 'Иран' },
    { value: 'Ирландия', text: 'Ирландия' },
    { value: 'Исландия', text: 'Исландия' },
    { value: 'Испания', text: 'Испания' },
    { value: 'Италия', text: 'Италия' },
    { value: 'Казахстан', text: 'Казахстан' },
    { value: 'Камерун', text: 'Камерун' },
    { value: 'Канада', text: 'Канада' },
    { value: 'Катар', text: 'Катар' },
    { value: 'Кения', text: 'Кения' },
    { value: 'Кипр', text: 'Кипр' },
    { value: 'Китай', text: 'Китай' },
    { value: 'Колумбия', text: 'Колумбия' },
    { value: 'Корея Северная', text: 'Корея Северная' },
    { value: 'Корея Южная', text: 'Корея Южная' },
    { value: 'Коста-Рика', text: 'Коста-Рика' },
    { value: 'Куба', text: 'Куба' },
    { value: 'Кувейт', text: 'Кувейт' },
    { value: 'Кыргызстан', text: 'Кыргызстан' },
    { value: 'Латвия', text: 'Латвия' },
    { value: 'Ливан', text: 'Ливан' },
    { value: 'Литва', text: 'Литва' },
    { value: 'Люксембург', text: 'Люксембург' },
    { value: 'Малайзия', text: 'Малайзия' },
    { value: 'Мальта', text: 'Мальта' },
    { value: 'Марокко', text: 'Марокко' },
    { value: 'Мексика', text: 'Мексика' },
    { value: 'Молдова', text: 'Молдова' },
    { value: 'Монголия', text: 'Монголия' },
    { value: 'Нигерия', text: 'Нигерия' },
    { value: 'Нидерланды', text: 'Нидерланды' },
    { value: 'Новая Зеландия', text: 'Новая Зеландия' },
    { value: 'Норвегия', text: 'Норвегия' },
    { value: 'ОАЭ', text: 'ОАЭ' },
    { value: 'Оман', text: 'Оман' },
    { value: 'Пакистан', text: 'Пакистан' },
    { value: 'Перу', text: 'Перу' },
    { value: 'Польша', text: 'Польша' },
    { value: 'Португалия', text: 'Португалия' },
    { value: 'Пуэрто Рико', text: 'Пуэрто Рико' },
    { value: 'Россия', text: 'Россия' },
    { value: 'Румыния', text: 'Румыния' },
    { value: 'Саудовская Аравия', text: 'Саудовская Аравия' },
    { value: 'Сербия', text: 'Сербия' },
    { value: 'Сингапур', text: 'Сингапур' },
    { value: 'Сирия', text: 'Сирия' },
    { value: 'Словакия', text: 'Словакия' },
    { value: 'Словения', text: 'Словения' },
    { value: 'СССР', text: 'СССР' },
    { value: 'Судан', text: 'Судан' },
    { value: 'США', text: 'США' },
    { value: 'Таиланд', text: 'Таиланд' },
    { value: 'Тайвань', text: 'Тайвань' },
    { value: 'Тунис', text: 'Тунис' },
    { value: 'Турция', text: 'Турция' },
    { value: 'Узбекистан', text: 'Узбекистан' },
    { value: 'Украина', text: 'Украина' },
    { value: 'Уругвай', text: 'Уругвай' },
    { value: 'Филиппины', text: 'Филиппины' },
    { value: 'Финляндия', text: 'Финляндия' },
    { value: 'Франция', text: 'Франция' },
    { value: 'ФРГ', text: 'ФРГ' },
    { value: 'Хорватия', text: 'Хорватия' },
    { value: 'Черногория', text: 'Черногория' },
    { value: 'Чехия', text: 'Чехия' },
    { value: 'Чехословакия', text: 'Чехословакия' },
    { value: 'Чили', text: 'Чили' },
    { value: 'Швейцария', text: 'Швейцария' },
    { value: 'Швеция', text: 'Швеция' },
    { value: 'Шотландия', text: 'Шотландия' },
    { value: 'Эстония', text: 'Эстония' },
    { value: 'ЮАР', text: 'ЮАР' },
    { value: 'Югославия', text: 'Югославия' },
    { value: 'Япония', text: 'Япония' }
];

/**
 * Get a genre option by value.
 * @param {string} value
 * @returns {GenreOption | undefined}
 */
export function getGenreOption(value) {
    return genreOptions.find((o) => o.value === value);
}

/**
 * Get a country option by value.
 * @param {string} value
 * @returns {CountryOption | undefined}
 */
export function getCountryOption(value) {
    return countryOptions.find((o) => o.value === value);
}

/**
 * Check if a value is "all" (no filter selected).
 * @param {string} value
 * @returns {boolean}
 */
export function isAllValue(value) {
    return value === 'all';
}

/**
 * Format a genre selection string for display (e.g., "Драмы, Комедия").
 * @param {string[]} selectedIds
 * @param {boolean} includeAll
 * @returns {string}
 */
export function formatGenreSelection(selectedIds, includeAll = false) {
    if (!selectedIds.length) return includeAll ? 'Любой жанр' : '';
    const texts = selectedIds
        .map((id) => genreOptions.find((o) => o.value === id)?.text || id)
        .filter(Boolean);
    return texts.join(', ');
}

/**
 * Format a country selection string for display.
 * @param {string[]} selectedIds
 * @param {boolean} includeAll
 * @returns {string}
 */
export function formatCountrySelection(selectedIds, includeAll = false) {
    if (!selectedIds.length) return includeAll ? 'Любая страна' : '';
    const texts = selectedIds
        .map((id) => countryOptions.find((o) => o.value === id)?.text || id)
        .filter(Boolean);
    return texts.join(', ');
}
