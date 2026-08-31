// Suporte multi-imóvel: a app tem UM único store (`data`) partilhado por todos os
// residenciais. Apartamentos e reservas ficam num único array "achatado", com
// `apartamentos[].residencialId` a dizer a que imóvel pertence cada apartamento
// (as reservas herdam o imóvel implicitamente, pelo `apartamentoId`). Temporadas,
// taxas, cupões, meios de pagamento e idiomas são partilhados entre imóveis.
//
// `buildScoped` produz um objecto `data` "à moda antiga" (para o PublicSite e as
// vistas do admin não precisarem de saber que existe mais do que um imóvel):
// `settings` passa a ser o registo do residencial seleccionado, e
// `apartamentos`/`reservas` vêm filtrados para esse imóvel.
//
// `mergeScopedBack` faz o caminho inverso quando uma vista chama `update(fn)`:
// recebe o resultado de `fn(scoped)` e junta-o de volta ao `data` completo,
// substituindo apenas a fatia deste imóvel (apartamentos/reservas/settings) e
// aceitando directamente o resto (temporadas, taxas, cupões, pagamentos —
// campos partilhados, editados globalmente a partir de qualquer imóvel).

export function residencialApartIds(data, residencialId) {
  return new Set(data.apartamentos.filter(a => a.residencialId === residencialId).map(a => a.id));
}

export function buildScoped(data, residencialId) {
  const residencial = data.residenciais.find(r => r.id === residencialId) || data.residenciais[0];
  const aptIds = residencialApartIds(data, residencialId);
  return {
    ...data,
    settings: residencial,
    apartamentos: data.apartamentos.filter(a => a.residencialId === residencialId),
    reservas: data.reservas.filter(r => aptIds.has(r.apartamentoId)),
  };
}

export function mergeScopedBack(prev, residencialId, nextScoped) {
  const prevAptIds = residencialApartIds(prev, residencialId);
  const apartamentosOutros = prev.apartamentos.filter(a => a.residencialId !== residencialId);
  const apartamentosEste = (nextScoped.apartamentos || []).map(a => ({ ...a, residencialId: a.residencialId || residencialId }));
  const reservasOutras = prev.reservas.filter(r => !prevAptIds.has(r.apartamentoId));
  const reservasEste = nextScoped.reservas || [];
  const residenciais = prev.residenciais.map(r => (r.id === residencialId ? { ...nextScoped.settings, id: residencialId } : r));

  return {
    ...prev,
    ...nextScoped,               // temporadas, taxas, cupões, pagamentos, idiomas — partilhados, aceites tal-qual
    apartamentos: [...apartamentosOutros, ...apartamentosEste],
    reservas: [...reservasOutras, ...reservasEste],
    residenciais,
    settings: undefined,         // "settings" só existe na vista `scoped`; no store real vive em `residenciais`
  };
}
