(() => {
  const ruToRo = {
    "На главную":"Pagina principală", "Выйти":"Ieșire", "Уведомления":"Notificări", "Прочитать все":"Citește toate",
    "Загрузка профиля...":"Se încarcă profilul...", "+ Новый заказ":"+ Comandă nouă", "+ Новый рейс":"+ Cursă nouă",
    "Обзор":"Prezentare", "Мои заявки":"Cererile mele", "Доступные грузы":"Mărfuri disponibile", "Сообщения":"Mesaje",
    "Перевозчики":"Transportatori", "Избранное":"Favorite", "Отзывы":"Recenzii", "Мой транспорт":"Transportul meu",
    "Настройки":"Setări", "Основная информация":"Informații principale", "Email":"Email", "Телефон":"Telefon",
    "Дата регистрации":"Data înregistrării", "Профиль компании":"Profilul companiei", "Профиль клиента":"Profilul clientului",
    "Профиль перевозчика":"Profilul transportatorului", "Название компании":"Denumirea companiei", "Не указано":"Nespecificat",
    "Адрес":"Adresă", "Номер лицензии":"Numărul licenței", "Статус проверки":"Statutul verificării",
    "Подтверждён ✓":"Verificat ✓", "Не подтверждён":"Neverificat", "Профиль и настройки":"Profil și setări",
    "Редактировать профиль":"Editează profilul", "Тёмная тема":"Tema întunecată", "Изменить оформление личного кабинета":"Schimbă aspectul contului personal",
    "Включить":"Activează", "Включить светлую":"Activează tema luminoasă", "Включить тёмную":"Activează tema întunecată",
    "Безопасность":"Securitate", "Сменить пароль":"Schimbă parola", "Текущий пароль":"Parola curentă", "Новый пароль":"Parolă nouă",
    "Повторите новый пароль":"Repetă parola nouă", "Не менее 8 символов, должны быть буквы и цифры.":"Minimum 8 caractere, cu litere și cifre.",
    "Отмена":"Anulează", "Сохранить":"Salvează", "Редактирование профиля":"Editarea profilului", "Имя":"Nume",
    "IDNO":"IDNO", "Мои автомобили":"Vehiculele mele", "Пока нет добавленных автомобилей.":"Nu ai adăugat încă vehicule.",
    "+ Добавить автомобиль":"+ Adaugă vehicul", "Марка":"Marcă", "Модель":"Model", "Гос. номер":"Număr de înmatriculare",
    "Грузоподъёмность, кг":"Capacitate de încărcare, kg", "Тип кузова":"Tip caroserie", "Не указан":"Nespecificat",
    "Тент":"Prelată", "Рефрижератор":"Frigorific", "Изотерм":"Izoterm", "Борт":"Platformă", "Самосвал":"Basculantă", "Другое":"Altul",
    "Откуда":"De unde", "Куда":"Încotro", "Сбросить":"Resetează", "Перевозчики":"Transportatori",
    "Откройте профиль, оцените опыт и транспорт, затем назначьте исполнителя одному из своих свободных заказов.":"Deschide profilul, evaluează experiența și vehiculele, apoi atribuie transportatorul unei comenzi disponibile.",
    "Избранные перевозчики":"Transportatori favoriți", "Здесь будут отображаться перевозчики, которых вы сохранили для быстрого доступа.":"Aici vor apărea transportatorii salvați pentru acces rapid.",
    "Пока нет избранных перевозчиков.":"Nu ai încă transportatori favoriți.", "Переписка с клиентом или перевозчиком по конкретному заказу. Новые сообщения появляются автоматически.":"Conversația cu clientul sau transportatorul pentru o comandă. Mesajele noi apar automat.",
    "Поиск переписки":"Caută conversația", "Имя, город или тип груза...":"Nume, oraș sau tip de marfă...", "Загрузка...":"Se încarcă...",
    "← Назад":"← Înapoi", "Груз уже не в работе — переписка доступна только для чтения.":"Marfa nu mai este activă — conversația este disponibilă doar pentru citire.",
    "Напишите сообщение...":"Scrie un mesaj...", "Отправить":"Trimite", "Не удалось загрузить профиль. Возможно, сессия истекла.":"Profilul nu a putut fi încărcat. Este posibil ca sesiunea să fi expirat.",
    "Вернуться на главную и войти заново":"Revino la pagina principală și autentifică-te din nou", "Фото профиля обновлено":"Fotografia profilului a fost actualizată",
    "Выберите фото JPG, PNG или WebP":"Alege o fotografie JPG, PNG sau WebP", "Размер фото не должен превышать 2 МБ":"Fotografia nu trebuie să depășească 2 MB",
    "Не удалось загрузить фото":"Fotografia nu a putut fi încărcată", "Фото профиля":"Fotografia profilului", "Изменить фото":"Schimbă fotografia",
    "Пользователь":"Utilizator", "Клиент":"Client", "Перевозчик":"Transportator", "Администратор":"Administrator",
    "Не указан":"Nespecificat", "Профиль обновлён":"Profilul a fost actualizat", "Пароль успешно изменён":"Parola a fost schimbată cu succes",
    "Заявки":"Cereri", "Грузы":"Mărfuri", "Каталог":"Catalog", "Чаты":"Chat-uri", "Профиль":"Profil",
    "Мои рейсы":"Cursele mele", "Пока нет выставленных рейсов.":"Nu ai publicat încă curse.", "+ Выставить рейс":"+ Publică o cursă",
    "Выберите город":"Alege orașul", "Дата отправления":"Data plecării", "Автомобиль":"Vehicul", "Не выбран":"Neselectat",
    "Свободная загрузка, кг":"Capacitate disponibilă, kg", "Цена, MDL":"Preț, MDL", "Комментарий":"Comentariu",
    "Выставить рейс":"Publică cursa", "Актуальные грузы от клиентов. Откликнитесь с вашей ценой — контакты заказчика откроются, если выберут вас.":"Mărfuri actuale de la clienți. Trimite oferta ta — datele clientului vor fi disponibile dacă te alege.",
    "Пока нет доступных грузов.":"Momentan nu există mărfuri disponibile.", "Обновить список":"Reîmprospătează lista", "Мои отклики":"Ofertele mele",
    "Вы пока не откликались на грузы.":"Nu ai trimis încă oferte pentru mărfuri.", "Мои отзывы":"Recenziile mele", "Отзывов пока нет. Они появятся после доставки грузов.":"Nu există recenzii încă. Acestea vor apărea după livrarea mărfurilor.",
    "Мои грузы":"Mărfurile mele", "Пока нет размещённых грузов.":"Nu ai publicat încă mărfuri.", "+ Разместить груз":"+ Publică marfă",
    "Город отправления":"Orașul de expediere", "Адрес отправления (улица, дом)":"Adresa de expediere (stradă, număr)",
    "Город доставки":"Orașul de livrare", "Адрес доставки (улица, дом)":"Adresa de livrare (stradă, număr)", "Тип груза":"Tipul mărfii",
    "Вес, кг":"Greutate, kg", "Дата готовности":"Data disponibilității", "Бюджет, MDL":"Buget, MDL", "Разместить":"Publică",
    "Рейсы перевозчиков":"Cursele transportatorilor", "Свободные рейсы с контактами перевозчиков. Если рейс подходит, свяжитесь напрямую или разместите груз по этому маршруту.":"Curse disponibile cu datele transportatorilor. Dacă o cursă se potrivește, contactează direct transportatorul sau publică o marfă pe acest traseu.",
    "Подходящих рейсов пока нет.":"Momentan nu există curse potrivite.", "Доступные грузы":"Mărfuri disponibile", "Загрузка перевозчиков...":"Se încarcă transportatorii...",
    "Добавить":"Adaugă", "Выбрать":"Selectează", "Откликнуться":"Trimite ofertă", "Принять":"Acceptă", "Отклонить":"Respinge",
    "Активен":"Activ", "Завершён":"Finalizat", "В работе":"În desfășurare", "Отменён":"Anulat", "Ожидает":"În așteptare",
    "Контакты":"Contacte", "Подробнее":"Detalii", "Удалить":"Șterge", "Сохранить изменения":"Salvează modificările",
    "Пароль успешно изменён":"Parola a fost schimbată cu succes", "Текущий пароль неверен":"Parola curentă este incorectă",
    "Новый пароль и подтверждение не совпадают":"Parola nouă și confirmarea nu coincid", "Ошибка сервера":"Eroare de server"
  };
  const roToRu = Object.fromEntries(Object.entries(ruToRo).map(([ru, ro]) => [ro, ru]));
  const button = document.getElementById('cabinetLanguageToggle');
  let language = localStorage.getItem('cargogo-language') === 'ro' ? 'ro' : 'ru';
  const dict = () => language === 'ro' ? ruToRo : roToRu;

  function translateTextNode(node) {
    const raw = node.nodeValue;
    const trimmed = raw.trim();
    if (!trimmed) return;
    const translated = dict()[trimmed];
    if (translated) node.nodeValue = raw.replace(trimmed, translated);
  }
  function applyLanguage() {
    document.documentElement.lang = language;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(translateTextNode);
    document.querySelectorAll('input[placeholder], textarea[placeholder]').forEach(el => {
      const value = dict()[el.placeholder]; if (value) el.placeholder = value;
    });
    document.querySelectorAll('[title], [aria-label]').forEach(el => {
      ['title', 'aria-label'].forEach(attr => { const value = el.getAttribute(attr); if (value && dict()[value]) el.setAttribute(attr, dict()[value]); });
    });
    if (button) {
      button.textContent = language === 'ru' ? 'RO' : 'RU';
      button.setAttribute('aria-label', language === 'ru' ? 'Schimbă limba în română' : 'Schimbă limba în rusă');
      button.title = language === 'ru' ? 'Limba română' : 'Limba rusă';
    }
    document.dispatchEvent(new CustomEvent('cargogo:cabinet-languagechange', { detail: { language } }));
  }
  if (button) button.addEventListener('click', () => {
    language = language === 'ru' ? 'ro' : 'ru';
    localStorage.setItem('cargogo-language', language);
    applyLanguage();
  });
  document.addEventListener('DOMContentLoaded', applyLanguage);
  const observer = new MutationObserver(records => {
    records.forEach(record => {
      record.addedNodes.forEach(node => {
        if (node.nodeType === Node.TEXT_NODE) translateTextNode(node);
        else if (node.nodeType === Node.ELEMENT_NODE) {
          const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
          while (walker.nextNode()) translateTextNode(walker.currentNode);
          if (node.matches?.('input[placeholder], textarea[placeholder]')) {
            const value = dict()[node.placeholder]; if (value) node.placeholder = value;
          }
        }
      });
    });
  });
  if (document.body) observer.observe(document.body, { childList: true, subtree: true });
  window.CARGOGO_CABINET_I18N = { get language() { return language; }, apply: applyLanguage };
})();
