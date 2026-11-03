# Forma - Dashboard roadmapy i prognoz

## Wspolny plan online

Gotowa konfiguracja **GitHub Pages + Supabase** zapewnia publiczny adres strony z danymi dostepnymi tylko zatwierdzonym kontom po zalogowaniu. Zapis do PostgreSQL obejmuje wszystkie zakladki, a kontrola wersji chroni przed nadpisywaniem rownoczesnych zmian. Konfiguracja projektu, kont i wdrozenia: [DEPLOYMENT.md](DEPLOYMENT.md). Samo dodanie kodu nie publikuje jeszcze strony ani nie tworzy projektu Supabase.

Otworz `index.html` w aktualnej przegladarce. Nie potrzeba Node.js, serwera ani procesu budowania. Zakladka **Roadmapa i prognozy** jest glownym widokiem, obok zakladki **Dashboard**. Przy pierwszym otwarciu dostepne sa 3 przykladowe inicjatywy, 3 zespoly i 4 kompetencje.

## Dane i przeplyw

1. W **Zespoly i kompetencje** dodaj kompetencje i zespoly, zaznaczajac kompetencje kazdego zespolu.
2. W **Capacity** uzupelnij dostepnosc kazdej kompetencji zespolu na 12 miesiecy. Mozna zmienic poczatek horyzontu i powielic pierwszy miesiac.
3. Dodaj dowolna liczbe inicjatyw (rowniez 2 lub wiecej), nazwij je i zaznacz zaangazowane zespoly.
4. Dla kazdego elementu podaj zespol, kompetencje, min/max osobodni, opcjonalny start i zaleznosc od wczesniejszego elementu. **Fixed date** oznacza wymagany termin zakonczenia.
5. Przelicz prognoze po zmianie capacity. Zapis inicjatywy przelicza ja automatycznie. Gantt pokazuje P50, bufor do P85 i wymagane terminy; przeglad pokazuje daty i szanse dla kazdego elementu.

## Zalozenia modelu

- 1500 niezaleznych symulacji Monte Carlo. Naklad kazdego elementu jest losowany z rozkladu jednostajnego min/max biblioteki jStat. Nie modelujemy korelacji estymat, swiat ani urlopow oddzielnie; nalezy uwzglednic je w capacity.
- Estymaty sa w **osobodniach**, nie dniach kalendarzowych. To pozwala wyliczyc czas trwania z capacity. Miesieczne capacity jest rozlozone rownomiernie na dni poniedzialek-piatek. Np. 20 osobodni/miesiac i naklad 10 osobodni to okolo pol miesiaca.
- Pula zasobow to para **zespol + kompetencja**, wspoldzielona przez wszystkie inicjatywy. Kompetencje tego samego zespolu sa niezaleznymi pulami: jesli osoby maja kilka kompetencji, rozdziel ich osobodni pomiedzy pule, aby nie liczyc dostepnosci wielokrotnie.
- Kolejnosc inicjatyw, a potem elementow, ustala priorytet rezerwacji capacity. Strzalka w edytorze podnosi priorytet inicjatywy. Elementy bez zaleznosci moga dzialac rownolegle na niezaleznych pulach; wspolna pula moze byc dzielona w jednym dniu, bez przekroczenia capacity.
- Start elementu nie moze byc wczesniejszy niz start inicjatywy lub poczatek horyzontu. Nastepca zaleznosci zaczyna najwczesniej w kolejnym dniu roboczym po zakonczeniu poprzednika. Zaleznosci wskazuja tylko wczesniejsze elementy tej samej inicjatywy, wiec cykle nie sa dozwolone.
- **P85** to 85. percentyl daty ukonczenia z wszystkich prob. Dla inicjatywy jest liczony z maksimum dat elementow w kazdej probie, dla portfolio z maksimum wszystkich elementow. Nie jest maksimum indywidualnych percentyli i nie stanowi gwarancji. Start na Gantcie jest medianowym startem, nie wspolnym przedzialem ufnosci.
- Proby nieukonczone w rocznym horyzoncie maja date nieskonczona; nie sa odrzucane z percentyli. Jesli ponad 15% prob nie konczy sie w roku, P85 jest oznaczane jako **poza horyzontem**. Brak capacity nie oznacza ukonczenia.
- **Fixed date** nie przesuwa prognozy i nie dodaje zasobow: mierzy odsetek prob ukonczonych do wymaganego terminu. Wynik ponizej 85% sygnalizuje ryzyko. Status inicjatywy uwzglednia laczna szanse dotrzymania wszystkich jej wymaganych terminow.

## Zapis i przenoszenie

Dane w lokalnej wersji plikowej bez konfiguracji sa przechowywane w localStorage danego profilu przegladarki. Po konfiguracji chmury wspolny plan jest przechowywany w PostgreSQL Supabase; dane chmurowe nie sa kopiowane do localStorage. Eksport/import JSON pozwala przeniesc workspace i wykonac kopie zapasowa. Import jest walidowany przed zastapieniem danych. Usuwanie zasobow uzywanych przez elementy jest blokowane. Maksymalnie 30 inicjatyw, 30 zespolow, 30 kompetencji i 200 elementow, aby ograniczyc obciazenie przegladarki.

Biblioteki jStat 1.9.6 i Lucide 0.468.0 sa zapisane lokalnie razem z licencjami MIT (odpowiednio `LICENSE-jstat.txt` i `LICENSE-lucide.txt`). Google Fonts jest opcjonalnym zewnetrznym zasobem; bez sieci dziala font zastepczy, a wszystkie funkcje pozostaja dostepne.

## Testy

Otworz `tests.html`. Testy nie wymagaja instalacji: sprawdzaja daty, weekendy, capacity wspoldzielone, zaleznosci, starty, rozklad min/max, P85 elementow/inicjatyw/portfolio, terminy, przejscie pomiedzy miesiacami, rok przestepny oraz nieukonczone proby. Testy synchronizacji korzystaja z kontrolowanego klienta testowego, sprawdzajac logowanie, uprawnienia, kolejke zapisow, bledy sieci i konflikty wersji. Reguly bazy mozna sprawdzic transakcyjnym skryptem `supabase/security-tests.sql` opisanym w instrukcji wdrozenia.