freebox-jasmin
=======================

Lance un serveur UPNP pour faire apparaitre >>>> JASMIN <<<< dans la liste des serveurs UPNP de la freebox HD.

Installation
---

Pour installer freebox-jasmin en global :

```bash
npm install --global --production freebox-jasmin
```

Pour une installation locale dans un dossier :

```bash
git clone --branch v0.1-alpha https://github.com/oeuillot/freebox-jasmin.git
cd freebox-jasmin
npm install --production
```

Lancement
---

En mode global, une fois tout installé, vous pouvez lancer :

```bash
freebox-jasmin run
```

En mode dossier, dans le dossier de freebox-jasmin :

```bash
node index.js run
```

Logs
----
Pour avoir un minimum de logs, vous pouvez spécifier:

```bash
export DEBUG=freebox-jasmin,freebox-jasmin:clientsList,freebox-jasmin:upnp,freebox-qml-run
```

Vous pouvez retirer un des éléments de la liste si cela ne vous intéresse pas !


Mise à jour
---
Pour mettre à jour freebox-jasmin

Mode global:
```bash
npm update -g freebox-jasmin
```

Mode dossier (dans le dossier de freebox-jasmin)
```bash
npm --depth 2 update 
```


PM2
---

Je vous conseille d'utiliser pm2 afin de lancer freebox-jasmin à chaque démarrage du serveur ( https://github.com/Unitech/pm2 )

```sh
pm2 start index.js --name "freebox-jasmin" --watch 
```

Afin d'économiser de la mémoire, il est possible de configurer la VM de nodejs :


```sh
pm2 start index.js --name "freebox-jasmin"  --watch --node-args="--optimize_for_size --max_old_space_size=460 --gc_interval=100 --always_compact --max_executable_size=64 --gc_global"
```


