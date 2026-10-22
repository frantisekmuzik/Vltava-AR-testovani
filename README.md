# VLTAVA – Příběh řeky na mapách a plánech (AR)

![Náhled aplikace](./src/assets/preview.png)

Webová aplikace rozšířené reality k atlasu **VLTAVA – Příběh řeky na mapách a plánech**. Pro zobrazení rozšířené reality stačí namířit kameru telefonu na stránku atlasu se **Zvíkovem** nebo **Frymburkem** a nad mapou se zobrazí 3D model krajiny. Modely lze přepínat mezi **19., 20. a 21. stoletím** a porovnat historický landuse se současným stavem krajiny v okolí vodních nádrží **Lipno** a **Orlík**.

## Vyzkoušet

**Odkaz na vyzkoušení:** https://frantisekmuzik.github.io/Zvikov-AR/

Otevři odkaz na telefonu nebo naskenuj QR kód:

<img alt="QR kód pro otevření aplikace" src="./docs/qr_aplikace.png" width="220" />

## Jak to funguje

1. Otevři odkaz v prohlížeči na **mobilním zařízení** a povol kameru.
2. Naskenuj stránku atlasu s mapou Zvíkova nebo Frymburku. *Aplikaci lze vyzkoušet i bez papírového atlasu. Otevři aplikaci na telefonu a namiř kameru na jednu z map níže zobrazenou na druhém zařízení (počítač, tablet) nebo na jejich výtisk. Mapu na obrazovce zobraz celou, co největší a bez odlesků.*
3. Nad stránkou se zobrazí 3D model. Tlačítky dole přepínáš období (19., 20. a 21. století), tlačítko vpravo nahoře zapíná vodní nádrž (Lipno u Frymburku, Orlík u Zvíkova).
4. Legenda s měřítkem je součástí modelu.

Aplikace běží přímo v prohlížeči, neinstaluje se a nepotřebuje účet.

<table>
  <tr>
    <td align="center"><a href="./docs/mapa_zvikov.jpg"><img alt="Mapa Zvíkov" src="./docs/mapa_zvikov.jpg" width="320" /></a><br><b>Zvíkov</b></td>
    <td align="center"><a href="./docs/mapa_frymburk.jpg"><img alt="Mapa Frymburk" src="./docs/mapa_frymburk.jpg" width="320" /></a><br><b>Frymburk</b></td>
  </tr>
</table>

## Obsah projektu

| Cesta | K čemu slouží |
| --- | --- |
| `src/.expanse.json` | scéna 8th Wall Studia (modely, image targety, tlačítka) |
| `src/tlacitka.ts` | přepínání období a hladiny vodní nádrže, tlačítka s českou diakritikou |
| `src/scan-prompt.ts` | úvodní výzva k naskenování stránky atlasu |
| `src/fonts.ts`, `src/assets/fonts/` | písmo Merriweather Sans (OFL) |
| `src/assets/modely/` | 3D modely krajiny (GLB) |
| `image-targets/` | data pro rozpoznání stránek atlasu (Zvíkov, Frymburk) |
| `docs/` | mapy ke zkušebnímu skenování a QR kód aplikace |
| `.github/workflows/deploy.yml` | automatický deploy na GitHub Pages |

## Vývoj

Projekt vznikl v [8th Wall Studiu](https://www.8thwall.com/).

Použité písmo: [Merriweather Sans](https://fonts.google.com/specimen/Merriweather+Sans), licence SIL OFL 1.1.

## Autor

**František Mužík**, katedra geomatiky, Fakulta stavební ČVUT v Praze.