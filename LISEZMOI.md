# Virage TCG : guide d'installation et d'entretien

## 1. Les fichiers à mettre en ligne

```
index.html            le jeu complet (apparence, cartes, jeu, mode en ligne)
admin.html            la page d'administration (réservée aux comptes admin)
legal.html            mentions légales, confidentialité, conditions d'utilisation
favicon.svg, apple-touch-icon.png, icon-192.png, icon-512.png   les icônes
og.png, site.webmanifest                                       l'aperçu de partage et l'installation sur téléphone
assets/credits.js     tes crédits photo (déjà chez toi)
assets/players/       tes photos de joueurs (déjà chez toi)
```

Les fichiers `.sql` et ce guide ne sont pas à mettre en ligne : ils servent seulement à Supabase.

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
| `trade_min_level` / `trade_min_days` | 5 / 2 | niveau et ancienneté requis pour vendre et échanger |

**Départ et niveaux.** Un nouveau compte commence avec 0 pièce et 10 boosters gratuits. Passer du niveau L au niveau L+1 demande 150 × L XP (niveau 5 = 1 500 XP, niveau 10 = 6 750 XP). Atteindre le niveau L rapporte 50 × L pièces (1 000 maximum). XP gagnée : nouvelle carte 10, doublon d'un booster payant 3, victoire 20, nul ou défaite 5, achat dans l’offre du jour 10. Ces valeurs sont dans `g_xp`, `v_level`, `open_pack` et `play_match`.

**Cadeau du jour.** Série de 7 jours : 100, 150, 200, 250, 300, 400 puis 500 pièces et une carte Épique. Un jour manqué remet la série à 1 (fonction `claim_daily`).

**Booster Légendes.** 7 500 pièces : 4 cartes Rares ou mieux, puis une Épique ou mieux. La dernière carte a 10 % de chances d'être une Icône (35 cartes Mythiques de la ligue Légendes), garantie au 10e booster Légendes sans Icône ; cette Icône garantie est une nouvelle si possible. Les 32 Icônes ajoutées (colonne `excl` de la table `cards`) sortent aussi des boosters Europe et Élite, au taux Mythique normal (0,3 %), mais pas de l'offre du jour ni des cartes offertes. Prix, taux et garantie sont dans `open_pack` (serveur) et `PACKS.icon`, `ICON_P`, `PITY_ICON` (`index.html`) : garde les deux identiques.

**Garanties des boosters.** Une Épique ou mieux au 10e booster sans Épique. Une Mythique au 200e booster sans Mythique (compteur `pity_leg`, dans `open_pack` et `PITY_LEG` côté `index.html`) ; elle est honorée même dans un booster de championnat.

**Limite de Mythiques.** Un onze contient 5 Mythiques au plus (`set_squad` et `g_team` côté serveur, `MYTH_MAX` côté `index.html`).

**Enchères.** Onglet Enchères du marché. Le vendeur choisit une mise de départ (mêmes bornes que les ventes) et une durée de 6, 12, 24 ou 48 heures ; la carte est mise de côté. Chaque mise est prélevée tout de suite et rendue dès qu'un joueur surenchérit (au moins +5 %, 10 pièces minimum). Une mise dans les deux dernières minutes prolonge l'enchère de deux minutes. À la fin, le gagnant reçoit la carte et le vendeur la mise moins la taxe ; sans mise, la carte revient au vendeur. Une enchère qui a reçu une mise ne peut plus être retirée. Les mises sont plafonnées au prix maximum des ventes, pour empêcher le transfert de pièces entre comptes. Annonces et enchères partagent la limite `max_listings`. Le règlement se fait à la première visite d'un joueur après la fin (fonction `g_expire`), sans tâche planifiée.

**Missions (bouton Missions).** Trois onglets. *Quotidiennes* : les 4 missions du jour. *Hebdomadaires* (remises à zéro le lundi) : 30 boosters (1 500), 40 nouvelles cartes (1 500), 12 victoires (2 000), 3 victoires contre des joueurs (1 500), 3 Épiques ou mieux (1 500). *Succès* (une seule fois, par paliers) : cartes différentes, niveau, matchs gagnés, boosters ouverts, Mythiques, albums, victoires contre des joueurs, et « Ta voix compte » (1 000 pièces pour avoir publié un avis, une seule fois ; un avis masqué par la modération ne compte pas) ; environ 121 000 pièces au total. Barèmes dans `claim_goal` et `v_ach` (serveur), `WEEK` et `ACH` (`index.html`) : garde-les identiques.

**Gros tirages.** Chaque Légendaire ou Mythique tirée est enregistrée (table `big_pulls`, 14 jours) et affichée à tous les joueurs dans la boutique, avec le pseudo. Le fil se met à jour à chaque point de synchronisation (environ une minute).

**Avis des joueurs.** Un avis par joueur (1 à 5 étoiles, 10 à 280 caractères, niveau 2 requis, liens refusés), affiché en bandeau sur la page d'inscription et en bas de la boutique. Modération : page d'administration, rubrique « Avis des joueurs », bouton Masquer.

**Amis.** Onglet du marché « Amis » (et bouton « Mes amis » dans Profil) : ajout par pseudo, demandes reçues/envoyées, 100 amis et 20 demandes en attente au plus, une demande refusée ne peut pas être renvoyée avant 7 jours. On voit les doublons et les envies d'un ami, et on peut lui réserver une offre d'échange : lui seul la voit et peut l'accepter (`trades.target`). Retirer un ami annule les offres réservées entre vous et rend les cartes. Fonctions `friend_request`, `friend_respond`, `friend_remove`, `friends_list`, `friend_view` ; notifications `ami_demande`, `ami_ok`, `echange_ami`.

**Mon activité.** Onglet du marché : ventes, enchères, mises et échanges en cours, puis les 60 dernières opérations terminées (fonction `market_activity`).

**Parrainage.** Chaque joueur a un lien `viragetcg.com/?parrain=SonPseudo` (Profil). Un nouveau compte créé avec ce lien enregistre son parrain ; quand le filleul atteint le niveau 5, les deux reçoivent 1 500 pièces. Limites : parrain enregistré dans les 7 jours suivant l'inscription, 20 filleuls récompensés par parrain (fonctions `set_referrer` et `g_ref_pay`).

Pour changer une valeur : modifie-la dans le script et relance-le. Regarde l'onglet « Pièces créées et détruites » de l'administration après quelques semaines. Si les créations dépassent nettement les retraits, baisse `bank_cap` ou monte `tax`.

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
- **Réglages Supabase à vérifier** : Authentication → Sign In / Providers → Email : « Confirm email » activé, longueur minimale du mot de passe **8** ; Authentication → Attack Protection : captcha Turnstile activé avec la clé secrète ; Authentication → URL Configuration : Site URL `https://viragetcg.com` et uniquement ce domaine dans les Redirect URLs ; ne jamais mettre la clé `service_role` / `sb_secret` dans le site.
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
