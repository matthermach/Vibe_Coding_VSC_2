# Publikacja: GitHub Pages + Supabase

Strona bedzie dostepna publicznie pod adresem GitHub Pages, ale dane beda dostepne **tylko zatwierdzonym uzytkownikom po zalogowaniu**. Ten katalog zawiera gotowy kod i konfiguracje, nie oznacza to jeszcze uruchomienia uslug. Potrzebne sa Twoje konto GitHub i projekt Supabase. Nie przekazuj nikomu hasla do bazy ani klucza `service_role` / `sb_secret_*`.

## 1. Supabase

1. Utworz projekt na https://supabase.com/dashboard. Sprawdz aktualne limity i cennik planu przed utworzeniem uslugi.
2. W SQL Editor uruchom caly plik [supabase/schema.sql](supabase/schema.sql). Tworzy on jeden wspolny workspace, liste zatwierdzonych kont, reguly RLS i funkcje zapisu z kontrola wersji.
3. W ustawieniach API skopiuj **Project URL** oraz **publishable key** (ewentualnie starszy publiczny klucz `anon`). Te dwie wartosci sa publiczna konfiguracja klienta. Klucza `service_role`, `sb_secret_*` ani hasla do PostgreSQL nigdy nie umieszczaj w repozytorium lub kodzie strony.

## 2. Repozytorium i GitHub Pages

1. Wyslij kod do swojego repozytorium GitHub. Nie trzeba instalowac Node.js lokalnie.
2. W repozytorium przejdz do **Settings > Pages > Build and deployment > Source** i wybierz **GitHub Actions**.
3. W **Settings > Secrets and variables > Actions > Variables** dodaj zmienne repozytorium:
   - `SUPABASE_URL`: adres projektu, np. `https://PROJECT.supabase.co`.
   - `SUPABASE_PUBLISHABLE_KEY`: publiczny klucz publishable lub anon.
4. W zakladce **Actions** uruchom workflow **Publish Forma to GitHub Pages**. Kolejne zmiany na `main` lub `master` beda wdrazane automatycznie. Jesli korzystasz z innej galezi, zmien filtr `branches` w workflow lub uruchamiaj go recznie.
5. Adres strony bedzie widoczny w wyniku kroku **Deploy** i w ustawieniach Pages, zwykle `https://OWNER.github.io/REPO/`.

Workflow generuje konfiguracje z tych zmiennych i publikuje tylko pliki aplikacji oraz licencje, bez SQL, testow, dokumentacji i zawartosci `.git`. Brak konfiguracji lub sekretny klucz zatrzymuje publikacje. Brak konfiguracji w wersji HTTP nie uruchamia lokalnej wersji demo: dostep do planu pozostaje zablokowany.

## 3. Logowanie i zatwierdzanie osob

1. W Supabase **Authentication > URL Configuration** ustaw **Site URL** na dokladny adres Pages z koncowym `/`. Dodaj ten sam adres do **Redirect URLs**. Gdy uzywasz pelnego adresu z `index.html`, dodaj rowniez ten dokladny adres. Nie stosuj szerokiego wildcardu dla cudzych domen.
2. Wylacz publiczne tworzenie kont w ustawieniach Auth. Aplikacja sama nie tworzy kont (`shouldCreateUser: false`).
3. W **Authentication > Users** zapros uzytkownika przez e-mail. Konto musi istniec przed nadaniem czlonkostwa. Zapros rowniez swoje konto.
4. W SQL Editor zatwierdz kazde konto osobno, podajac jego e-mail:

```sql
insert into public.roadmap_members (user_id)
select id from auth.users where lower(email) = lower('osoba@firma.pl')
on conflict (user_id) do nothing;
```

Jesli zapytanie dodalo 0 wierszy i konto nie bylo wczesniej zatwierdzone, sprawdz, czy zostalo juz utworzone/zaproszone w Auth. Zweryfikuj czlonkostwo w Table Editor.

5. Otworz strone Pages. Zatwierdzony uzytkownik wpisuje e-mail i otwiera otrzymany link w tej samej przegladarce. Link zaproszenia rowniez moze zalogowac uzytkownika. Po zatwierdzeniu konta zalogowanego wczesniej uzyj **Sprawdz dostep ponownie**.
6. Do realnego uzycia przez zespol skonfiguruj wlasny SMTP w Supabase Auth. Domyslna usluga e-mail ma ograniczenia odbiorcow i limitow; sprawdz jej aktualne zasady. Skonfiguruj rowniez adekwatne limity wysylki, aby uniknac naduzyc publicznego formularza.

Kazdy zatwierdzony uzytkownik moze czytac i edytowac ten sam plan. Publiczny klucz nie nadaje uprawnien. Tylko administrator projektu moze dodawac czlonkow; aplikacja nie pozwala uzytkownikom nadawac dostepu innym.

Cofniecie dostepu:

```sql
delete from public.roadmap_members
where user_id in (select id from auth.users where lower(email) = lower('osoba@firma.pl'));
```

RLS blokuje nastepny odczyt/zapis natychmiast. Otwarta aplikacja sprawdza uprawnienia przy odswiezaniu; dane juz zobaczone lub wyeksportowane przez uzytkownika nie moga zostac zdalnie cofniete.

## 4. Pierwsze dane i wspolna praca

- Pierwsza zatwierdzona osoba wybiera **Utworz pusty plan** albo **Przenies dane z tego urzadzenia**. Dane lokalne nie sa automatycznie publikowane.
- Przy migracji z wersji plikowej najlepiej najpierw wyeksportuj JSON w starej wersji, a nastepnie zaloguj sie na stronie i zaimportuj plik do wspolnego planu. `file:` i GitHub Pages nie wspoldziela localStorage.
- Wszystkie zakladki zapisuja jeden dokument JSONB w PostgreSQL. Potwierdzeniem jest status **Zapisano w bazie**, nie sam komunikat o edycji formularza.
- Zmiany innych osob sa pobierane co 15 sekund oraz po powrocie do okna. Automatyczny odczyt jest wstrzymany podczas edycji w modalu i przy aktywnym polu capacity. Capacity zatwierdza sie opuszczeniem pola.
- Kazdy zapis musi podac oczekiwana wersje. Gdy inna osoba zapisze plan wczesniej, Twoja wersja nie nadpisze bazy: mozesz ja wyeksportowac, pobrac aktualny plan i ponownie wprowadzic zmiany. Nie ma automatycznego scalania jednoczesnych edycji.
- Przy bledzie sieci niepotwierdzone zmiany pozostaja w pamieci otwartej karty. Uzyj ponowienia zapisu lub eksportu. Zamkniecie karty lub wylogowanie moze je odrzucic; aplikacja wyswietla ostrzezenie.
- W trybie chmurowym tresc planu nie jest zapisywana w localStorage; sesja logowania jest utrzymywana przez Supabase Auth. Na wspolnym komputerze wyloguj sie po pracy. Eksporty JSON zawieraja dane i wymagaja odpowiedniego przechowywania.
- Monte Carlo jest liczone lokalnie z tych samych wspoldzielonych danych. Losowe prognozy w roznych przegladarkach moga nieznacznie roznic sie wynikami.

## 5. Weryfikacja

- Otworz lokalnie [tests.html](tests.html): testy silnika oraz adaptera synchronizacji nie wymagaja konta Supabase.
- Po migracji uruchom [supabase/security-tests.sql](supabase/security-tests.sql) w SQL Editor. Testy tworza tymczasowe dane w transakcji i koncza sie `ROLLBACK`. Jesli test przerwie sie bledem, wykonaj `ROLLBACK` przed dalsza praca. Nie wymagaja prawdziwych hasel ani kont testowych.
- W prawdziwej usludze sprawdz dwie niezalezne przegladarki/konta: brak dostepu przed logowaniem, odrzucenie niezatwierdzonego konta, wspolny zapis i odczyt, konflikt wersji oraz cofniecie dostepu.
- Skonfiguruj kopie zapasowe/eksporty odpowiednie do planu Supabase i potrzeb organizacji. Aplikacja przechowuje aktualny plan, nie historie wszystkich wersji.

## Lokalny podglad HTTP

```powershell
python -m http.server 8765 --bind 127.0.0.1
```

Adres: http://127.0.0.1:8765/. Bez konfiguracji pokazuje zablokowany workspace. Do lokalnego logowania uzupelnij publiczne wartosci w [cloud-config.js](cloud-config.js) i dodaj dokladny adres lokalny do Supabase Redirect URLs. Przy publikacji workflow zastapi ten plik wartosciami zmiennych repozytorium. Otwarcie `index.html` bezposrednio przez `file:` i bez konfiguracji zachowuje dotychczasowy, wylacznie lokalny tryb.