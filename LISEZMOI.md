# Virage TCG : guide d'installation et d'entretien

## 1. Les fichiers à mettre en ligne

```
index.html            le jeu complet (apparence, cartes, jeu, mode en ligne)
admin.html            la page d'administration (réservée aux comptes admin)
legal.html            mentions légales, confidentialité, conditions d'utilisation
favicon.svg, apple-touch-icon.png, icon-192.png, icon-512.png   les icônes
og.png, site.webmanifest                                       l'aperçu de partage et l'installation sur téléphone
sw.js, offline.html, badge-72.png, icon-maskable-512.png       l'appli installable et les notifications
assets/credits.js     tes crédits photo (déjà chez toi)
assets/players/       tes photos de joueurs (déjà chez toi)
```

Les fichiers `.sql`, `supabase-fonction-push.ts` et ce guide ne sont pas à mettre en ligne : ils servent seulement à Supabase.

Le site doit être servi en **https** (Netlify, Cloudflare Pages ou GitHub Pages le font gratuitement). Un compte est obligatoire pour jouer : à l'arrivée, un écran demande de s'inscrire ou de se connecter. Il faut donc que Supabase soit joignable.

## 2. Supabase : les scripts

Dans **SQL Editor**, colle chaque script en entier puis clique sur **Run** :

1. `supabase.sql` : comptes, profils et classement (une seule fois).
2. `supabase-securite.sql` : le serveur de jeu complet. **Relance-le à chaque nouvelle version** que je te donne : il met à jour les fonctions et les cartes sans effacer les parties.

`supabase-echanges.sql` n'est plus nécessaire : le script de sécurité le remplace.

## 3. Supabase : les réglages

**Authentication → URL Configuration**
- *Site URL* : l'adresse de ton jeu, par exemple `https://virage-tcg.netlify.app`.
- *Redirect URLs* : ajoute la même adresse suivie de `/**`.

**Authentication → Sign In / Providers → Email**
- Laisse **Confirm email** activé. C'est la première protection contre les comptes créés en série.

**Captcha anti-robots (recommandé dès que le jeu est public)**
1. Crée un widget *Turnstile* gratuit sur le tableau de bord Cloudflare (Turnstile → Add widget), avec le domaine de ton jeu.
2. Dans Supabase : **Authentication → Attack Protection** → active *Captcha protection*, choisis *Turnstile*, colle la **clé secrète**.
3. Dans `index.html`, cherche `const CAPTCHA_SITEKEY='';` (Ctrl+F) et colle la **clé de site** entre les apostrophes.

Fais les deux dernières étapes en même temps : si Supabase exige un captcha que le jeu n'envoie pas, plus personne ne peut se connecter.

## 4. Devenir administrateur

Une fois ton compte créé dans le jeu, exécute dans SQL Editor (avec ton adresse) :

```sql
insert into public.admins (user_id)
select id from auth.users where email = 'ton-adresse@exemple.fr';
```

Un bouton **Administration** apparaît alors dans ton profil. La page permet de :
- voir l'économie (pièces créées et détruites sur 7 jours) ;
- chercher un joueur par pseudo ou e-mail, voir son journal de pièces et ses partenaires d'échange (utile pour repérer des comptes multiples) ;
- ajuster ses pièces avec un motif (le joueur le voit) ;
- suspendre ou réactiver son compte.

## 5. Sauvegardes

Le plan gratuit de Supabase ne garde pas de sauvegardes que tu peux restaurer toi-même, et met en pause un projet resté inactif une semaine (vérifie ces deux points sur ta page de facturation, ils peuvent changer). Une sauvegarde par semaine suffit au début :

1. Installe PostgreSQL (pour l'outil `pg_dump`) ou la Supabase CLI.
2. Récupère la chaîne de connexion : bouton **Connect** en haut du tableau de bord, onglet *Session pooler*, avec ton mot de passe de base.
3. Lance :
   ```
   pg_dump "COLLE-ICI-LA-CHAINE" --schema=public --schema=auth -Fc -f virage-2026-11-11.dump
   ```
   Avec la CLI : `supabase db dump --db-url "COLLE-ICI-LA-CHAINE" -f virage.sql`.

Garde ces fichiers hors de ton ordinateur (clé USB, cloud). Ils contiennent les e-mails des joueurs : ne les partage pas.

## 6. Réglages de l'économie

Ils sont regroupés dans la fonction `v_cfg` de `supabase-securite.sql` :

| Réglage | Valeur | Rôle |
|---|---|---|
| `bank_cap` | 4000 | pièces maximum par jour en vente rapide |
| `tax` | 0.10 | taxe sur les ventes et les pièces échangées entre joueurs |
| `max_listings` | 10 | annonces en cours par joueur |
| `max_trades` | 5 | offres d'échange ouvertes par joueur |
| `match_cap` | 15 | matchs contre les clubs récompensés par jour |
| `match_cooldown` | 6 | secondes minimum entre deux matchs |
| `pvp_cap` / `pvp_same` | 10 / 3 | matchs entre joueurs récompensés par jour / contre le même joueur |
| `trade_min_level` / `trade_min_days` | 5 / 0 | niveau et ancienneté (en jours, 0 = aucune) requis pour vendre et échanger |

**Départ et niveaux.** Un nouveau compte commence avec 0 pièce et 10 boosters gratuits. Passer du niveau L au niveau L+1 demande 150 × L XP (niveau 5 = 1 500 XP, niveau 10 = 6 750 XP). Atteindre le niveau L rapporte 50 × L pièces (1 000 maximum). XP gagnée : nouvelle carte 10, doublon d'un booster payant 3, victoire 20, nul ou défaite 5, achat dans l’offre du jour 10. Ces valeurs sont dans `g_xp`, `v_level`, `open_pack` et `play_match`.

**Cadeau du jour.** Série de 7 jours : 100, 150, 200, 250, 300, 400 puis 500 pièces et une carte Épique. Un jour manqué remet la série à 1 (fonction `claim_daily`).

**Booster Légendes.** 7 500 pièces : 4 cartes Rares ou mieux, puis une Épique ou mieux. La dernière carte a 10 % de chances d'être une Icône (35 cartes Mythiques de la ligue Légendes), garantie au 10e booster Légendes sans Icône ; cette Icône garantie est une nouvelle si possible. Les 32 Icônes ajoutées (colonne `excl` de la table `cards`) sortent aussi des boosters Europe et Élite, au taux Mythique normal (0,3 %), mais pas de l'offre du jour ni des cartes offertes. Prix, taux et garantie sont dans `open_pack` (serveur) et `PACKS.icon`, `ICON_P`, `PITY_ICON` (`index.html`) : garde les deux identiques.

**Garanties des boosters.** Une Épique ou mieux au 10e booster sans Épique. Une Mythique au 200e booster sans Mythique (compteur `pity_leg`, dans `open_pack` et `PITY_LEG` côté `index.html`) ; elle est honorée même dans un booster de championnat.

**Limite de Mythiques.** Un onze contient 5 Mythiques au plus (`set_squad` et `g_team` côté serveur, `MYTH_MAX` côté `index.html`).

**Enchères.** Onglet Enchères du marché. Le vendeur choisit une mise de départ (mêmes bornes que les ventes) et une durée de 6, 12, 24 ou 48 heures ; la carte est mise de côté. Chaque mise est prélevée tout de suite et rendue dès qu'un joueur surenchérit (au moins +5 %, 10 pièces minimum). Une mise dans les deux dernières minutes prolonge l'enchère de deux minutes. À la fin, le gagnant reçoit la carte et le vendeur la mise moins la taxe ; sans mise, la carte revient au vendeur. Une enchère qui a reçu une mise ne peut plus être retirée. Les mises sont plafonnées au prix maximum des ventes, pour empêcher le transfert de pièces entre comptes. Annonces et enchères partagent la limite `max_listings`. Le règlement se fait à la première visite d'un joueur après la fin (fonction `g_expire`), sans tâche planifiée.

**Missions (bouton Missions).** Cinq onglets (Parcours et Défis d'équipe : voir plus bas). *Quotidiennes* : les 4 missions du jour. *Hebdomadaires* (remises à zéro le lundi) : 30 boosters (1 500), 40 nouvelles cartes (1 500), 12 victoires (2 000), 3 victoires contre des joueurs (1 500), 3 Épiques ou mieux (1 500). *Succès* (une seule fois, par paliers) : cartes différentes, niveau, matchs gagnés, boosters ouverts, Mythiques, albums, victoires contre des joueurs, et « Ta voix compte » (1 000 pièces pour avoir publié un avis, une seule fois ; un avis masqué par la modération ne compte pas) ; environ 121 000 pièces au total. Barèmes dans `claim_goal` et `v_ach` (serveur), `WEEK` et `ACH` (`index.html`) : garde-les identiques.

**Gros tirages.** Chaque Légendaire ou Mythique tirée est enregistrée (table `big_pulls`, 14 jours) et affichée à tous les joueurs dans la boutique, avec le pseudo. Le fil se met à jour à chaque point de synchronisation (environ une minute).

**Avis des joueurs.** Un avis par joueur (1 à 5 étoiles, 10 à 280 caractères, niveau 2 requis, liens refusés), affiché en bandeau sur la page d'inscription et en bas de la boutique. Modération : page d'administration, rubrique « Avis des joueurs », bouton Masquer.

**Amis.** Onglet du marché « Amis » (et bouton « Mes amis » dans Profil) : ajout par pseudo, demandes reçues/envoyées, 100 amis et 20 demandes en attente au plus, une demande refusée ne peut pas être renvoyée avant 7 jours. On peut réserver une offre d'échange à un joueur : lui seul la voit et peut l'accepter (`trades.target`) ; hors amis, 20 offres réservées par jour au plus. Retirer un ami annule les offres réservées entre vous et rend les cartes. Fonctions `friend_request`, `friend_respond`, `friend_remove`, `friends_list`, `friend_view` ; notifications `ami_demande`, `ami_ok`, `echange_ami`.

**Profils des joueurs.** Toucher un pseudo (classement, marché, enchères, échanges, matchs en ligne, amis) ouvre la page profil du joueur (`#joueur/Pseudo`, lien partageable, bouton « ← Retour ») : niveau, date d'inscription, cartes uniques, valeur du classeur, meilleure note, Elo, son onze sur le terrain (formation et note), ses cartes favorites, ses envies (celles que tu as en premier, bouton « Lui proposer ») et ses doublons (celles qui te manquent en premier, bouton « Je la veux »). « Proposer un échange » ouvre le formulaire d'échange avec une offre réservée à ce joueur, ami ou non. Depuis le profil on peut aussi l'ajouter en ami, accepter sa demande ou le retirer. Bouton « Mon profil public » dans Profil pour voir le sien. Connexion requise ; les comptes suspendus n'ont pas de profil. Fonction `player_view` (pièces, e-mail et collection complète ne sont jamais exposés).

**Compos enregistrées.** Dans Effectif, panneau « Mes compos » : jusqu'à 5 compos (formation + titulaires) enregistrées, chargées d'un geste. La compo en place sur le terrain (`players.squad`) est celle qui joue les matchs et sert de défense en ligne. Bouton ⋯ : aperçu du terrain, renommer (24 caractères), remplacer par la compo actuelle, supprimer (avec confirmation). Une carte qui n'est plus dans la collection laisse son poste vide au chargement. Stockées dans `players.presets` (fonction `set_presets`, synchronisée avec la partie) ; hors ligne, dans la sauvegarde du navigateur.

**Codes cadeaux.** Dans `admin.html`, panneau « Codes cadeaux » : un code (3 à 24 caractères, lettres, chiffres, tirets ; bouton 🎲 pour en générer un) donne des pièces (100 000 au plus), des boosters gratuits (30 au plus, au-delà du stock normal de 10) et/ou une carte précise (recherche par nom). Options : nombre maximal d'utilisations, date d'expiration, note interne. Liste avec compteur d'utilisations, statut (actif, expiré, épuisé, désactivé), « Copier le lien », « Modifier », « Désactiver/Réactiver ». Côté joueur : panneau « Code cadeau » en haut de Profil, ou lien direct `viragetcg.com/#code/CODE` qui ouvre Profil avec le code rempli. Un code sert une fois par compte ; 10 codes faux par heure au plus (contre les essais au hasard). Les pièces apparaissent au journal sous « Code cadeau ». Tables `promo_codes`, `promo_uses`, `promo_fails` ; fonctions `redeem_code`, `admin_codes`, `admin_code_save`, `admin_code_active`, `admin_cards`.

**Partager une carte.** Bouton « Partager en image » sur la fiche d'une carte possédée, et « Partager ma carte Épique / Légendaire / Mythique » à la fin d'un booster qui en contient une. Le jeu dessine dans le navigateur une image story 1080 × 1920 (logo, rareté, la carte, « Joue gratuitement sur viragetcg.com ») : la carte y porte toujours la silhouette aux couleurs du club, jamais la photo du joueur (droit à l'image et licences des photos). Sur téléphone, « Partager l'image » ouvre le menu de partage (TikTok, Instagram, WhatsApp…) avec le lien de parrainage du joueur dans le texte ; partout, « Télécharger l'image » et « Copier mon lien de parrainage ». En anglais si le jeu est en anglais. Aucun envoi au serveur.

**Équipe de la semaine.** Dans `admin.html`, panneau « Équipe de la semaine » : semaine (préremplie, format 2026-47), date de fin (lundi suivant par défaut, 15 jours au plus), jusqu'à 15 joueurs (11 conseillés, Icônes exclues) avec un bonus de +1 à +6 chacun (+3 par défaut). Chaque joueur reçoit une carte spéciale `<id>-sem202647` : note et statistiques + bonus (99 au plus), au moins Épique, cadre noir et or avec le badge « Semaine 47 ». Pendant la semaine, la 4e carte d'un booster a une chance d'être une carte de la semaine (Europe 2 %, Championnat 3 % et seulement celles de ce championnat, Élite 6 %, Légendes 12 %) ; après la date de fin, plus jamais. Republier la même semaine ajoute des joueurs et change la date de fin sans toucher aux cartes existantes ; « Terminer maintenant » arrête les tirages. Liste des semaines avec le nombre de joueurs qui possèdent chaque carte. Côté joueur : vitrine dans la Boutique (cartes, compte à rebours, nombre obtenu), cartes en tête de la Collection, fiche « Semaine 47 · +3 sur la carte normale », révélation « Équipe de la semaine ! » à l'ouverture, image de partage dédiée. Les cartes spéciales restent à vie, se vendent et s'échangent comme les autres, peuvent jouer dans le onze (jamais avec la carte normale du même joueur : erreur `joueur_en_double`), ne comptent pas dans les cartes uniques, les albums ni les tirages ordinaires (`cards.active = false`, colonnes `base`, `sp`, `sp_week`, `sp_end`, table `tw_weeks`, fonctions `admin_tw_publish`, `admin_tw_list`, `admin_tw_end`).

**Parcours de saison (Missions › Parcours).** Gratuit, 30 paliers, remis à zéro le 1er de chaque mois (heure de Paris, comme la saison en ligne) : 40 points par palier, 1 200 pour tout finir. Points : booster ouvert 1, match gagné 3 (5 contre un joueur), mission ou succès encaissé 5, cadeau du jour 5, défi d'équipe réussi 10, match amical contre un ami 2 (5 par jour). Récompenses : pièces (300 à 4 000), boosters gratuits (1 à 5), cartes Rare/Épique/Légendaire (nouvelles si possible) et une Icône au palier 30 ; environ 17 000 pièces, 23 boosters et 11 cartes par mois. Bouton « Tout récupérer » ; les paliers non pris à la fin du mois sont perdus. Barème dans `v_pass_def` (serveur), points dans `g_bump`, `g_pass` et les fonctions `claim_*` ; colonne `players.pass`, fonction `claim_pass`.

**Défis d'équipe (Missions › Défis d'équipe).** Comme les SBC de FIFA : on donne des cartes (elles disparaissent) contre une récompense, pour écouler les doublons. Neuf défis : Recyclage (10 Communes → 1 booster, 5 fois par jour), Montée en gamme (5 Peu communes → 1 Rare, 10/jour), Le grand saut (5 Rares → 1 Épique, 5/jour), Collectionneur (4 Épiques → 1 Légendaire, 3/jour), Club fétiche (5 cartes du même club → 1 000 pièces + 1 booster, 2/semaine), Onze tricolore (11 Français, moyenne 75 → 2 000 pièces + 2 boosters, 1/semaine), Championnat uni (11 du même championnat, moyenne 78 → 1 500 pièces + 1 Épique), Tour du monde (11 cartes, 6 nationalités, moyenne 72 → 1 500 pièces + 1 booster), Défi des champions (11 cartes, moyenne 84, dont 2 Légendaires ou mieux → 1 Icône, 1 par mois). L'atelier montre les conditions en direct, « Remplir avec mes doublons » choisit d'abord des copies en trop, puis des cartes uniques hors onze et favorites ; avertissement si on donne une dernière copie (une carte du onze en sort), confirmation avant l'envoi. Barème dans `v_sbc` (modifiable : clés `n`, `r`, `nat`, `club`, `lg`, `nats`, `ovr`, `top`, `rep` day/week/month, `lim`, récompense `rw`) ; fonction `sbc_submit`, colonne `players.sbc`. Les pièces apparaissent au journal sous « Défi d'équipe ».

**Défier un ami.** Bouton « ⚔ Défier » dans la liste d'amis et sur le profil d'un ami : match contre son onze, sans Elo ni pièces ni points de saison, avec le bilan entre vous (victoires, nuls, défaites). Les 5 premiers matchs amicaux du jour donnent 2 points de parcours. L'ami reçoit une notification avec le score. Il faut un onze complet des deux côtés ; même délai entre deux matchs que les autres. Fonction `friend_match` (`pvp_log.friendly`).

**Pop-up « Quoi de neuf ? ».** À la connexion, une fenêtre présente les nouveautés, une seule fois par compte : dès que le joueur la ferme (bouton, croix ou clic à côté), elle ne revient plus, même sur un autre appareil. Seuls les comptes créés avant sa publication la voient (les nouveaux joueurs ont déjà le tutoriel). Le premier pop-up (parcours, défis d'équipe, défis entre amis, équipe de la semaine, appli et notifications, profils et compos) est créé par le script SQL. Pour les suivants : administration › « Pop-up Quoi de neuf ? » : titre, 1 à 8 nouveautés (une par ligne, un emoji au début devient l'icône), bouton facultatif vers un écran du jeu, version anglaise facultative, aperçu puis publication ; le précédent est retiré. La liste indique combien de joueurs l'ont vu et fermé. Table `site_news`, colonne `players.news_seen`, fonctions `news_seen`, `admin_news_list`, `admin_news_save`, `admin_news_active`.

**Mon activité.** Onglet du marché : ventes, enchères, mises et échanges en cours, puis les 60 dernières opérations terminées (fonction `market_activity`).

**Parrainage.** Chaque joueur a un lien `viragetcg.com/?parrain=SonPseudo` (Profil). Un nouveau compte créé avec ce lien enregistre son parrain ; quand le filleul atteint le niveau 5, les deux reçoivent 1 500 pièces. Limites : parrain enregistré dans les 7 jours suivant l'inscription, 20 filleuls récompensés par parrain (fonctions `set_referrer` et `g_ref_pay`).

Pour changer une valeur : modifie-la dans le script et relance-le. Regarde l'onglet « Pièces créées et détruites » de l'administration après quelques semaines. Si les créations dépassent nettement les retraits, baisse `bank_cap` ou monte `tax`.

## 6 bis. Appli et notifications push

**L'appli.** Le site s'installe comme une appli (icône sur l'écran d'accueil, plein écran, raccourcis Boutique / Missions / Marché) : sur Android et ordinateur, bouton « 📲 Installer l'appli » dans Profil › Appli et notifications (ou menu du navigateur) ; sur iPhone, Safari › Partager › « Sur l'écran d'accueil ». Le fichier `sw.js` (service worker) affiche une page « Pas de connexion » quand le réseau manque ; il ne garde jamais le jeu en cache, donc chaque mise en ligne est visible tout de suite. Fichiers : `sw.js`, `offline.html`, `badge-72.png`, `icon-maskable-512.png`, `site.webmanifest`.

**Ce que reçoivent les joueurs** (chacun choisit ses catégories dans Profil) :
- *Ventes, échanges, enchères* : carte vendue, échange accepté, surenchère, enchère gagnée ou vendue.
- *Envies* : une carte de ses envies mise en vente, aux enchères ou en échange.
- *Amis, défis, matchs* : demande d'ami, ami accepté, offre réservée, défi amical, match d'un joueur contre son onze, parrainage.
- *Rappels* (entre 9 h et 21 h) : cadeau du jour pas pris à 18 h, boosters gratuits pleins (joueur absent depuis 3 h), dernier jour du parcours à 18 h s'il reste des paliers.
- *Nouveautés* : nouvelle équipe de la semaine (automatique à la publication) et tes annonces.
Par défaut, rien entre 22 h et 8 h (réglable), 15 notifications par jour au plus par joueur. Le texte suit la langue du jeu (FR/EN). Sur iPhone, les notifications ne marchent qu'une fois l'appli installée sur l'écran d'accueil (iOS 16.4 ou plus).

**Comment ça marche.** Chaque notification du jeu (table `notices`) et chaque rappel passe par une file (`push_queue`). Chaque minute, une tâche planifiée (`pg_cron`, tâche `virage-push`, fonction `g_push_tick`) prépare les rappels puis envoie la file par lots à la fonction Edge `push` (extension `pg_net`). Cette fonction chiffre chaque message (standard Web Push) et l'envoie aux navigateurs. Les appareils désinstallés sont retirés tout seuls.

**Installation (une seule fois, environ 10 minutes).**
1. Relance `supabase-securite.sql`. Il active `pg_net` et `pg_cron` et crée la tâche. Si l'administration signale une extension absente : Supabase › Database › Extensions, active `pg_net` et `pg_cron`, puis relance le script.
2. Page d'administration › Notifications push › Installation et réglages › **Générer les clés**. Trois valeurs apparaissent : `VAPID_PUBLIC`, `VAPID_PRIVATE`, `PUSH_SECRET`.
3. Supabase › Edge Functions › **Secrets** : ajoute ces trois secrets avec exactement ces noms (bouton Copier). **Ne m'envoie jamais `VAPID_PRIVATE` ni `PUSH_SECRET`** : ils restent entre la page d'administration et Supabase.
4. Supabase › Edge Functions › **Deploy a new function** › Via Editor : nom `push`, colle tout le contenu de `supabase-fonction-push.ts`, déploie. Dans les réglages de la fonction, désactive **Verify JWT** (la base s'authentifie avec `PUSH_SECRET`).
5. Retour dans l'administration : vérifie l'adresse (`https://…supabase.co/functions/v1/push`), coche « Activer l'envoi », **Enregistrer**.
6. Dans le jeu, sur ton téléphone : Profil › Appli et notifications › Activer, puis « Envoyer un test ». La notification arrive en moins d'une minute.

**Suivi.** Le panneau affiche joueurs et appareils abonnés, file d'attente, envois, échecs, dernière erreur et l'heure de la dernière exécution de la tâche. Bouton « M'envoyer une notification de test » et formulaire **Annonce** (titre, texte, version anglaise facultative, écran à ouvrir) envoyé à tous les abonnés qui ont gardé « Nouveautés ». Régénérer les clés désabonne tous les appareils (une confirmation le rappelle) : à éviter une fois le jeu lancé. Tables `push_subs`, `push_queue`, `push_cfg` ; fonctions `push_subscribe`, `push_unsubscribe`, `push_prefs`, `push_test`, `admin_push_info`, `admin_push_save`, `admin_push_send` ; textes dans `g_push_msg`.

## 7. Mercato et mises à jour des cartes

**Version des données.** `index.html` contient `const BUILD=…` et le script SQL la même valeur (`v_build`). Si le serveur est plus récent que la page d'un joueur (cache du navigateur, ancienne page encore servie), le jeu se recharge tout seul ; si ça ne suffit pas, un bandeau l'explique. Si c'est le serveur qui est en retard, l'administrateur voit un message lui demandant de relancer `supabase-securite.sql`. D'où la règle : **à chaque livraison, mets le site en ligne et relance le script SQL dans la foulée.**

**Barème de rareté** (d'après la note) : Commun moins de 73, Peu commun 73 à 77, Rare 78 à 81, Épique 82 à 85, Légendaire 86 à 92, Mythique 93 et plus. Répartition actuelle : 1 721 / 1 099 / 526 / 176 / 69 / 37. Le barème est dans `rarOf` (`index.html`) ; le serveur reçoit la rareté de chaque carte par `supabase-securite.sql`.

**Défis de la semaine.** Le défi « Onze 100 % d'un championnat » oppose désormais un club de ce même championnat (moitié haute), pour rester jouable avec les championnats moins cotés. Le changement s'applique aux défis tirés à partir du lundi suivant la mise à jour.

**Championnats.** Le jeu couvre 8 championnats (saison 2026-27) : Premier League, LaLiga, Serie A, Bundesliga, Ligue 1, Liga Portugal, Eredivisie et Süper Lig, soit 3 628 cartes et 150 clubs. Les effectifs portugais, néerlandais et turcs viennent des pages d'effectif FotMob relevées le 14 novembre 2026. Les notes de ces trois championnats partent de la valeur marchande et de l'âge (script `data/new/rate.py`), puis sont corrigées à la main pour les joueurs connus.

La base des cartes existe en deux endroits qui doivent rester identiques : `index.html` (le jeu) et la table `cards` (le serveur, remplie par `supabase-securite.sql`). Pour un mercato, envoie-moi la liste des transferts : je régénère les deux d'un coup.

- **Changement de club** : la carte garde son identifiant, les joueurs qui la possèdent la gardent.
- **Joueur parti des 8 championnats** : sa carte reste dans les collections mais ne sort plus des boosters, de la boutique ni des équipes adverses.

## 7 bis. Anglais

Un bouton FR / EN (en-tête du jeu et page de connexion) change la langue ; le choix est gardé dans le navigateur, et un visiteur dont le navigateur est en anglais arrive directement en anglais. Le jeu reste écrit en français : la version anglaise remplace chaque texte à l'affichage d'après un dictionnaire (`data/i18n/en_*.txt`, une ligne « français, tabulation, anglais », les nombres étant écrits `#`). Un texte sans traduction reste en français. Ne sont pas traduits : les noms de clubs et de pays, les pages légales, les e-mails de Supabase et les avis des joueurs. Après un changement de texte en français, il faut ajouter sa traduction (demande-moi : `python3 data/i18n/check.py` liste les textes manquants).

## 8. Données personnelles

Chaque joueur peut télécharger toutes ses données et supprimer son compte depuis son profil (rubrique « Mes données personnelles »). La suppression efface aussi son journal de pièces.

Si le jeu devient public, ajoute un moyen de te contacter (une adresse e-mail dédiée) dans le texte de cette rubrique, dans `index.html` (cherche « Mes données personnelles »).

## 9. Avant d'ouvrir au public

- **Mentions légales** : remplies (éditeur Sola, contact viragetcg@gmail.com, hébergeurs, photos Wikimedia). À relire une fois.
- **E-mails d'inscription (Brevo)** : voir `emails-supabase.md` pour les réglages SMTP et les modèles d'e-mails en français.
- **Captcha** : voir la section 3. La clé de site se colle dans `index.html` (`const CAPTCHA_SITEKEY='';`) ou tu me la donnes.
- **Photos** : parcours `credits.html` et signale les erreurs (mauvais joueur, image floue).
- **Test réel** : deux comptes sur viragetcg.com, une vente, un échange, un match entre joueurs.

## 9 bis. Sécurité

- **Base de données** : RLS sur toutes les tables ; aucun accès direct en écriture ; lecture publique limitée aux colonnes du classement de `profiles` (`id, pseudo, level, cards, value, best_ovr, wins`) ; seules les fonctions du jeu sont appelables, les fonctions internes (`g_*`, `v_*`) et les déclencheurs ne le sont pas ; toutes les fonctions `security definer` fixent leur `search_path` ; chaque action passe par `g_lock` (verrou par joueur) et toutes les pièces par `g_coins` (journal `ledger`).
- **Page** : politique de contenu (CSP) dans une balise meta, avec l'empreinte de chaque script intégré, calculée par `build_site.py` : seuls le site, Supabase et Cloudflare Turnstile sont autorisés. **Ne modifie pas à la main un script dans `index.html`, `admin.html`, `legal.html` ou `credits.html` : reconstruis avec `build_site.py`, sinon le script est bloqué.** Les photos n'utilisent plus d'attributs `onload/onerror`. La page refuse de s'afficher dans le cadre d'un autre site. La bibliothèque Supabase est servie par le site (`assets/supabase.js`, version 2.99.0), plus par un CDN.
- **Si le domaine passe par Cloudflare (nuage orange)** : désactive Rocket Loader et l'obfuscation des e-mails, qui réécrivent les scripts et casseraient la CSP.
- **Réglages Supabase à vérifier** : Authentication → Sign In / Providers → Email : « Confirm email » activé, longueur minimale du mot de passe laissée à **6** (le minimum de Supabase, aucune règle de plus côté site) ; Authentication → Attack Protection : captcha Turnstile activé avec la clé secrète ; Authentication → URL Configuration : Site URL `https://viragetcg.com` et uniquement ce domaine dans les Redirect URLs ; ne jamais mettre la clé `service_role` / `sb_secret` dans le site.
- **Tests** : `sec3` (près de 90 tentatives de triche : prix et montants négatifs ou énormes, cartes d'un autre joueur, double encaissement, fonctions admin, accès direct aux tables, colonnes privées, parrainage croisé) et `csp` (aucune violation, photos, anti-cadre).

## 10. Ce qui a été vérifié

Le serveur a été testé sur une copie locale de PostgreSQL avec 101 vérifications, dont les tentatives de triche :
- modifier ses pièces ;
- s'ajouter des cartes ;
- acheter deux fois la même annonce ;
- dépenser en parallèle ;
- accepter un échange sans posséder la carte ;
- utiliser les fonctions d'administration sans en avoir le droit.

Le jeu complet a été testé de bout en bout avec deux joueurs simulés, plus la page d'administration et le mode hors ligne. **Rien n'a encore été testé sur ton vrai projet Supabase** : fais un tour complet avec deux comptes après installation.
