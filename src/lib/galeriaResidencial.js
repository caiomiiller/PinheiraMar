// Fotos de exteriores e áreas comuns de cada residencial (secção "Conheça o
// residencial" do site público). Ficheiros em /public/fotos/residencial/, em
// WebP de até 1600 px, gerados dos originais do acervo (sem efeitos aplicados).
// A chave é o id do residencial; o texto alternativo vai nos três idiomas.
const f = (arq, pt, es, en) => ({ src: `/fotos/residencial/${arq}.webp`, alt: { pt, es, en } });

export const GALERIA_RESIDENCIAL = {
  pinheiramar: [
    f('pm-01', 'Fachada do PinheiraMar vista do jardim, com a pérgola de troncos', 'Fachada de PinheiraMar vista desde el jardín, con la pérgola de troncos', 'PinheiraMar facade seen from the garden, with the log pergola'),
    f('pm-02', 'Fachada vista do jardim gramado', 'Fachada vista desde el jardín con césped', 'Facade seen from the lawn garden'),
    f('pm-03', 'Espreguiçadeiras de madeira no jardim', 'Reposeras de madera en el jardín', 'Wooden sun loungers in the garden'),
    f('pm-04', 'Passarela de madeira do jardim até a praia, com o galo-símbolo da casa', 'Pasarela de madera del jardín a la playa, con el gallo símbolo de la casa', 'Wooden walkway from the garden to the beach, with the rooster emblem'),
    f('pm-05', 'Jardim com pérgola, de frente para o mar', 'Jardín con pérgola frente al mar', 'Garden with pergola facing the sea'),
    f('pm-06', 'Fachada com guarda-sóis abertos no jardim', 'Fachada con sombrillas abiertas en el jardín', 'Facade with open parasols in the garden'),
    f('pm-07', 'Pérgola e espreguiçadeiras ao sol', 'Pérgola y reposeras al sol', 'Pergola and sun loungers in the sun'),
    f('pm-08', 'Mesa de mosaico em forma de flor, à beira-mar', 'Mesa de mosaico en forma de flor, junto al mar', 'Flower-shaped mosaic table by the sea'),
    f('pm-09', 'Pôr do sol sobre a enseada, visto do jardim', 'Atardecer sobre la ensenada, visto desde el jardín', 'Sunset over the cove, seen from the garden'),
    f('pm-10', 'A praia da Pinheira vista do alto, com a passarela do jardim', 'La playa de Pinheira vista desde arriba, con la pasarela del jardín', 'Pinheira beach seen from above, with the garden walkway'),
    f('pm-11', 'Recanto de plantas com banco no corredor', 'Rincón de plantas con banco en el pasillo', 'Plant corner with a bench in the hallway'),
    f('pm-12', 'Recepção e cantinho do café', 'Recepción y rincón del café', 'Reception and coffee corner'),
  ],
  novoimovel: [
    f('cdm-01', 'Rua e mar entre os pinheiros, a poucos passos do residencial', 'Calle y mar entre los pinos, a pocos pasos del residencial', 'Street and sea between the pine trees, a few steps from the residence'),
    f('cdm-02', 'Pátio interno com mesa e a escada amarela', 'Patio interno con mesa y la escalera amarilla', 'Inner courtyard with a table and the yellow staircase'),
    f('cdm-03', 'Pátio interno visto da varanda do andar de cima', 'Patio interno visto desde el balcón del piso superior', 'Inner courtyard seen from the upstairs balcony'),
    f('cdm-04', 'Telhados e o mar ao fundo, vistos de cima', 'Tejados y el mar al fondo, vistos desde arriba', 'Rooftops with the sea in the background, seen from above'),
    f('cdm-05', 'Varanda coberta do andar de cima, com mesa de refeições', 'Balcón cubierto del piso superior, con mesa para comidas', 'Covered upstairs balcony with a dining table'),
    f('cdm-06', 'Área coberta com mesas de madeira', 'Área cubierta con mesas de madera', 'Covered area with wooden tables'),
    f('cdm-07', 'Salão com mesa grande e janelas com vista', 'Salón con mesa grande y ventanas con vista', 'Hall with a large table and windows with a view'),
    f('cdm-08', 'Fachada com varandas e garagem coberta', 'Fachada con balcones y garaje cubierto', 'Facade with balconies and covered parking'),
    f('cdm-09', 'Portão de entrada com cobertura de madeira', 'Portón de entrada con cubierta de madera', 'Entrance gate with a wooden roof'),
  ],
};
