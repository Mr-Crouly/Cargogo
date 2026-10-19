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
    // Оставляем первый option (плейсхолдер «Откуда» / «Выберите город»)
    while (select.options.length > 1) select.remove(1);
    CITY_GROUPS.forEach((group) => {
      const optgroup = document.createElement("optgroup");
      optgroup.label = group.label;
      group.cities.forEach((city) => {
        const option = document.createElement("option");
        option.textContent = city;
        option.value = city;
        optgroup.appendChild(option);
      });
      select.appendChild(optgroup);
    });
  });
}

populateCitySelects();
