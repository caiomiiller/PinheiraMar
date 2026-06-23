import { useState } from 'react';

export const TRANSLATIONS = {
  pt: {
    /* header */
    nav_location: 'Praia da Pinheira, SC',
    /* hero */
    hero_tag: 'Frente para o mar',
    hero_loc: 'Praia da Pinheira, Palhoça — Santa Catarina',
    hero_title: 'Residencial PinheiraMar',
    hero_desc: 'Apartamentos residenciais completos, à beira-mar. Escolha as datas, veja a disponibilidade em tempo real e reserve a unidade ideal — o valor é por apartamento.',
    hero_chip1: 'Vista mar', hero_chip2: 'Wi-Fi grátis', hero_chip3: 'Estacionamento',
    hero_chip4: '2 a 8 hóspedes', hero_chip5: 'Apartamento completo',
    /* search */
    search_checkin: 'Check-in', search_checkout: 'Check-out',
    search_who: 'Quem', search_guests: 'Hóspedes',
    search_btn: 'Procurar', search_confirm: 'Confirmar',
    search_nights: (n) => `${n} ${n === 1 ? 'noite' : 'noites'}`,
    search_guests_label: (n) => `${n} hóspede${n > 1 ? 's' : ''}`,
    search_add_guests: 'Adicionar viajantes',
    /* results */
    results_title: (n) => `Apartamentos em Praia da Pinheira`,
    results_sub: (n) => `${n} alojamentos · Pinheira, Palhoça — Santa Catarina`,
    results_avail: (n) => `${n} ${n === 1 ? 'disponível' : 'disponíveis'}`,
    results_avail_for: (ci, co) => ` para ${ci}–${co}`,
    combo_title: (n) => `Para ${n} hóspedes é necessário combinar apartamentos.`,
    combo_max: (n) => `Cada unidade acomoda no máximo ${n} pessoas.`,
    combo_suggest: (names, cap) => ` Sugestão: reserve ${names} — juntos acomodam até ${cap} pessoas.`,
    combo_none: ' Sem unidades disponíveis suficientes nestas datas.',
    combo_book: (nome) => `Reservar ${nome}`,
    /* card */
    card_unavail: 'Indisponível', card_combine: 'Combinar',
    card_guests: (n) => `${n} hóspedes · apartamento completo`,
    card_combine_hint: (n) => `Para ${n} pessoas, combine com outra unidade`,
    card_night: 'noite', card_total: 'Total:',
    /* category pills */
    cat1: 'Frente Mar', cat2: 'Apartamento', cat3: 'Estacionamento',
    cat4: 'Wi-Fi', cat5: 'Famílias', cat6: 'Vista Mar', cat7: 'Praia', cat8: '2-8 pessoas',
    /* booking modal */
    book_title: (nome) => `Reservar ${nome}`, book_name: 'Nome completo',
    book_email: 'E-mail', book_phone: 'Telefone', book_guests: 'Hóspedes',
    book_total: 'Total', book_signal: 'Sinal (50%)', book_confirm: 'Confirmar reserva',
    book_cancel: 'Cancelar',
    /* footer */
    footer_copy: (y) => `© ${y} Residencial PinheiraMar · Praia da Pinheira, Palhoça — SC`,
  },
  es: {
    nav_location: 'Playa de Pinheira, SC',
    hero_tag: 'Frente al mar',
    hero_loc: 'Playa de Pinheira, Palhoça — Santa Catarina',
    hero_title: 'Residencial PinheiraMar',
    hero_desc: 'Apartamentos residenciales completos frente al mar. Elige las fechas, consulta la disponibilidad en tiempo real y reserva tu unidad — el precio es por apartamento.',
    hero_chip1: 'Vista al mar', hero_chip2: 'Wi-Fi gratis', hero_chip3: 'Estacionamiento',
    hero_chip4: '2 a 8 huéspedes', hero_chip5: 'Apartamento completo',
    search_checkin: 'Check-in', search_checkout: 'Check-out',
    search_who: 'Quién', search_guests: 'Huéspedes',
    search_btn: 'Buscar', search_confirm: 'Confirmar',
    search_nights: (n) => `${n} ${n === 1 ? 'noche' : 'noches'}`,
    search_guests_label: (n) => `${n} huésped${n > 1 ? 'es' : ''}`,
    search_add_guests: 'Añadir viajeros',
    results_title: () => 'Apartamentos en Playa de Pinheira',
    results_sub: (n) => `${n} alojamientos · Pinheira, Palhoça — Santa Catarina`,
    results_avail: (n) => `${n} ${n === 1 ? 'disponible' : 'disponibles'}`,
    results_avail_for: (ci, co) => ` para ${ci}–${co}`,
    combo_title: (n) => `Para ${n} huéspedes es necesario combinar apartamentos.`,
    combo_max: (n) => `Cada unidad admite un máximo de ${n} personas.`,
    combo_suggest: (names, cap) => ` Sugerencia: reserva ${names} — juntos admiten hasta ${cap} personas.`,
    combo_none: ' Sin unidades disponibles suficientes en estas fechas.',
    combo_book: (nome) => `Reservar ${nome}`,
    card_unavail: 'No disponible', card_combine: 'Combinar',
    card_guests: (n) => `${n} huéspedes · apartamento completo`,
    card_combine_hint: (n) => `Para ${n} personas, combina con otra unidad`,
    card_night: 'noche', card_total: 'Total:',
    cat1: 'Frente al mar', cat2: 'Apartamento', cat3: 'Estacionamiento',
    cat4: 'Wi-Fi', cat5: 'Familias', cat6: 'Vista al mar', cat7: 'Playa', cat8: '2-8 personas',
    book_title: (nome) => `Reservar ${nome}`, book_name: 'Nombre completo',
    book_email: 'Correo electrónico', book_phone: 'Teléfono', book_guests: 'Huéspedes',
    book_total: 'Total', book_signal: 'Señal (50%)', book_confirm: 'Confirmar reserva',
    book_cancel: 'Cancelar',
    footer_copy: (y) => `© ${y} Residencial PinheiraMar · Playa de Pinheira, Palhoça — SC`,
  },
  en: {
    nav_location: 'Pinheira Beach, SC',
    hero_tag: 'Oceanfront',
    hero_loc: 'Pinheira Beach, Palhoça — Santa Catarina, Brazil',
    hero_title: 'Residencial PinheiraMar',
    hero_desc: 'Complete residential apartments by the sea. Choose your dates, check real-time availability and book your unit — pricing is per apartment.',
    hero_chip1: 'Ocean view', hero_chip2: 'Free Wi-Fi', hero_chip3: 'Parking',
    hero_chip4: '2 to 8 guests', hero_chip5: 'Full apartment',
    search_checkin: 'Check-in', search_checkout: 'Check-out',
    search_who: 'Who', search_guests: 'Guests',
    search_btn: 'Search', search_confirm: 'Confirm',
    search_nights: (n) => `${n} ${n === 1 ? 'night' : 'nights'}`,
    search_guests_label: (n) => `${n} guest${n > 1 ? 's' : ''}`,
    search_add_guests: 'Add travellers',
    results_title: () => 'Apartments at Pinheira Beach',
    results_sub: (n) => `${n} listings · Pinheira Beach, Palhoça — Santa Catarina`,
    results_avail: (n) => `${n} ${n === 1 ? 'available' : 'available'}`,
    results_avail_for: (ci, co) => ` for ${ci}–${co}`,
    combo_title: (n) => `For ${n} guests you need to combine apartments.`,
    combo_max: (n) => `Each unit accommodates a maximum of ${n} people.`,
    combo_suggest: (names, cap) => ` Suggestion: book ${names} — together they fit up to ${cap} people.`,
    combo_none: ' Not enough available units for these dates.',
    combo_book: (nome) => `Book ${nome}`,
    card_unavail: 'Unavailable', card_combine: 'Combine',
    card_guests: (n) => `${n} guests · full apartment`,
    card_combine_hint: (n) => `For ${n} people, combine with another unit`,
    card_night: 'night', card_total: 'Total:',
    cat1: 'Oceanfront', cat2: 'Apartment', cat3: 'Parking',
    cat4: 'Wi-Fi', cat5: 'Families', cat6: 'Ocean view', cat7: 'Beach', cat8: '2-8 guests',
    book_title: (nome) => `Book ${nome}`, book_name: 'Full name',
    book_email: 'Email', book_phone: 'Phone', book_guests: 'Guests',
    book_total: 'Total', book_signal: 'Deposit (50%)', book_confirm: 'Confirm booking',
    book_cancel: 'Cancel',
    footer_copy: (y) => `© ${y} Residencial PinheiraMar · Pinheira Beach, Palhoça — SC, Brazil`,
  },
};

/* Hook — resolves a translation key; falls back to PT if missing */
export function useT(lang) {
  const dict = TRANSLATIONS[lang] || TRANSLATIONS['pt'];
  return (key, ...args) => {
    const val = dict[key] ?? TRANSLATIONS['pt'][key];
    if (typeof val === 'function') return val(...args);
    return val ?? key;
  };
}

/* ── IdiomasView ── */
/* ── TaxasView ── */
