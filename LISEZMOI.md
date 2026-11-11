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

**Départ et niveaux.** Un nouveau compte commence avec 0 pièce et 10 boosters gratuits. Passer du niveau L au niveau L+1 demande 150 × L XP (niveau 5 = 1 500 XP, niveau 10 = 6 750 XP). Atteindre le niveau L rapporte 50 × L pièces (1 000 maximum). XP gagnée : nouvelle carte 10, doublon d'un booster payant 3, victoire 20, nul ou défaite 5, achat en boutique ou atelier 10. Ces valeurs sont dans `g_xp`, `v_level`, `open_pack` et `play_match`.

Pour changer une valeur : modifie-la dans le script et relance-le. Regarde l'onglet « Pièces créées et détruites » de l'administration après quelques semaines. Si les créations dépassent nettement les retraits, baisse `bank_cap` ou monte `tax`.

## 7. Mercato et mises à jour des cartes

La base des cartes existe en deux endroits qui doivent rester identiques : `index.html` (le jeu) et la table `cards` (le serveur, remplie par `supabase-securite.sql`). Pour un mercato, envoie-moi la liste des transferts : je régénère les deux d'un coup.

- **Changement de club** : la carte garde son identifiant, les joueurs qui la possèdent la gardent.
- **Joueur parti du Top 5** : sa carte reste dans les collections mais ne sort plus des boosters, de la boutique ni des équipes adverses.

## 8. Données personnelles

Chaque joueur peut télécharger toutes ses données et supprimer son compte depuis son profil (rubrique « Mes données personnelles »). La suppression efface aussi son journal de pièces.

Si le jeu devient public, ajoute un moyen de te contacter (une adresse e-mail dédiée) dans le texte de cette rubrique, dans `index.html` (cherche « Mes données personnelles »).

## 9. Avant d'ouvrir au public : à compléter

- **`legal.html`** : remplace chaque passage surligné en jaune (`[TON NOM]`, `[ADRESSE E-MAIL DE CONTACT]`, adresses de Netlify et Supabase, région du projet, service d'e-mail, date). L'adresse de contact doit être réelle et lue.
- **Service d'e-mail** : branche Brevo, Resend ou équivalent dans *Authentication → SMTP Settings* ; l'envoi intégré de Supabase est trop limité pour un lancement.
- **Aperçu de partage** : donne-moi l'adresse définitive du site pour que l'image s'affiche partout (Discord, WhatsApp, Facebook demandent une adresse complète).

## 10. Ce qui a été vérifié

Le serveur a été testé sur une copie locale de PostgreSQL avec 101 vérifications, dont les tentatives de triche :
- modifier ses pièces ;
- s'ajouter des cartes ;
- acheter deux fois la même annonce ;
- dépenser en parallèle ;
- accepter un échange sans posséder la carte ;
- utiliser les fonctions d'administration sans en avoir le droit.

Le jeu complet a été testé de bout en bout avec deux joueurs simulés, plus la page d'administration et le mode hors ligne. **Rien n'a encore été testé sur ton vrai projet Supabase** : fais un tour complet avec deux comptes après installation.
