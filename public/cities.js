// Единый список городов для всех выпадающих списков «Откуда» / «Куда».
// Чтобы добавить город — просто добавьте его в нужную группу ниже.
const CITY_GROUPS = [
  {
    label: "Молдова",
    cities: [
      "Кишинёв", "Бельцы", "Тирасполь", "Бендеры", "Рыбница", "Кахул", "Унгены",
      "Сорока", "Оргеев", "Дубоссары", "Комрат", "Чадыр-Лунга", "Единцы",
      "Дрокия", "Фалешты", "Флорешты", "Страшены", "Хынчешты", "Кэушень",
      "Криуляны", "Ниспорены", "Яловены", "Штефан-Водэ", "Леова", "Басарабяска",
      "Слобозия", "Григориополь", "Каменка", "Вулканешты", "Тараклия", "Вадул-луй-Водэ"
    ]
  },
  {
    label: "Соседние страны",
    cities: [
      "Яссы", "Бухарест", "Галац", "Бакэу", "Сучава", "Клуж-Напока", "Тимишоара",
      "Одесса", "Черновцы", "Винница", "Киев", "Львов"
    ]
  }
];

function populateCitySelects() {
  document.querySelectorAll("select[data-cities]").forEach((select) => {
    const selectedValue = select.value;
    const placeholder = select.options[0];

    // Удаляем целые optgroup, а не только option: select.remove(index)
    // оставлял пустые группы, из-за чего после смены языка города дублировались.
    while (select.children.length > 1) {
      select.removeChild(select.lastElementChild);
    }

    if (placeholder) {
      const fromIds = ["originCity", "tripsFilterOrigin"];
      const toIds = ["destinationCity", "tripsFilterDestination"];
      const key = fromIds.includes(select.id) ? "from" : toIds.includes(select.id) ? "to" : "selectCity";
      const fallback = key === "from" ? "Откуда" : key === "to" ? "Куда" : "Выберите город";
      placeholder.textContent = window.CARGOGO_I18N?.t(key) || fallback;
    }

    CITY_GROUPS.forEach((group) => {
      const optgroup = document.createElement("optgroup");
      optgroup.label = group.label === "Молдова"
        ? (window.CARGOGO_I18N?.t("cityMoldova") || group.label)
        : (window.CARGOGO_I18N?.t("cityNeighbor") || group.label);

      group.cities.forEach((city) => {
        const option = document.createElement("option");
        option.textContent = window.CARGOGO_I18N ? window.CARGOGO_I18N.cityName(city) : city;
        // Значение остаётся каноническим русским названием для совместимости с БД.
        option.value = city;
        optgroup.appendChild(option);
      });
      select.appendChild(optgroup);
    });

    if (selectedValue && [...select.options].some(option => option.value === selectedValue)) {
      select.value = selectedValue;
    }
  });
}

populateCitySelects();
document.addEventListener('cargogo:languagechange', populateCitySelects);
