

export const TRANSLATIONS = {
  pt: {
    /* busca no celular — textos simples para o público 50+ */
    m_search_title: 'Encontre seu apartamento',
    m_arrival: 'Entrada', m_departure: 'Saída', m_pick_date: 'Escolher data',
    m_people: 'Quantas pessoas?', m_people_none: 'Toque no +',
    m_people_n: (n) => `${n} ${n === 1 ? 'pessoa' : 'pessoas'}`,
    m_see_available: 'Ver apartamentos disponíveis', m_clear: 'Limpar datas',
    /* search */
    search_checkin: 'Entrada', search_checkout: 'Saída',
    search_who: 'Pessoas', search_guests: 'Pessoas',
    search_btn: 'Ver apartamentos', search_confirm: 'Pronto',
    search_guests_label: (n) => `${n} pessoa${n > 1 ? 's' : ''}`,
    search_add_guests: 'Quantas pessoas?',
    /* category pills */
    cat1: 'Frente para o mar', cat2: 'Todos',
    cat_cap2: 'Para até 2 pessoas', cat_cap4: 'Para até 4 pessoas', cat_cap6: 'Para até 6 pessoas', cat_cap8: '8 ou mais pessoas',
  },
  es: {
    m_search_title: 'Encuentre su apartamento',
    m_arrival: 'Entrada', m_departure: 'Salida', m_pick_date: 'Elegir fecha',
    m_people: '¿Cuántas personas?', m_people_none: 'Toque el +',
    m_people_n: (n) => `${n} ${n === 1 ? 'persona' : 'personas'}`,
    m_see_available: 'Ver apartamentos disponibles', m_clear: 'Borrar fechas',
    search_checkin: 'Entrada', search_checkout: 'Salida',
    search_who: 'Personas', search_guests: 'Personas',
    search_btn: 'Ver departamentos', search_confirm: 'Listo',
    search_guests_label: (n) => `${n} persona${n > 1 ? 's' : ''}`,
    search_add_guests: '¿Cuántas personas?',
    cat1: 'Frente al mar', cat2: 'Todos',
    cat_cap2: 'Para hasta 2 personas', cat_cap4: 'Para hasta 4 personas', cat_cap6: 'Para hasta 6 personas', cat_cap8: '8 o más personas',
  },
  en: {
    m_search_title: 'Find your apartment',
    m_arrival: 'Check-in', m_departure: 'Check-out', m_pick_date: 'Choose date',
    m_people: 'How many guests?', m_people_none: 'Tap +',
    m_people_n: (n) => `${n} ${n === 1 ? 'person' : 'people'}`,
    m_see_available: 'See available apartments', m_clear: 'Clear dates',
    search_checkin: 'Check-in', search_checkout: 'Check-out',
    search_who: 'Guests', search_guests: 'Guests',
    search_btn: 'See apartments', search_confirm: 'Done',
    search_guests_label: (n) => `${n} guest${n > 1 ? 's' : ''}`,
    search_add_guests: 'How many guests?',
    cat1: 'Oceanfront', cat2: 'All',
    cat_cap2: 'For up to 2 guests', cat_cap4: 'For up to 4 guests', cat_cap6: 'For up to 6 guests', cat_cap8: '8 or more guests',
  },
};

