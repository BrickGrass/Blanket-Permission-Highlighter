# Blanket-Permission-Highlighter

This is a tampermonkey/greasemonkey extension which:
1. Highlights ao3 users listed as having blanket permission in rindle's [fpslist](https://www.fpslist.org/) in green
2. Injects a link to the fpslist author profile page to their ao3 profile page
3. Optionally filters out non-blanket permission author's works from search/bookmark results

# Examples

Extension working

![alt text](https://brickgrass.uk/media/images/fps_ext_example.png "Example of extension working on ao3")

Settings menu

![alt text](https://brickgrass.uk/media/images/tampermonkey_menu.png "Tampermonkey menu showing option to open settings for the highlighter extension")
![alt text](https://brickgrass.uk/media/images/bph_settings.png? "The settings menu for the extension")

# Installation

1. Install [Tampermonkey](https://www.tampermonkey.net/) or [Greasemonkey](https://www.greasespot.net/)
2. Click this [link](https://raw.githubusercontent.com/BrickGrass/Blanket-Permission-Highlighter/master/highlight.pub.user.js) to install the highlight extension
3. Enjoy!

You can contact me at BrickGrass#8455 on discord or @rustyshvl on twitter if you can't get it working and a github issue isn't appropriate.

# Extra Installation!

In the unlikely event that the server I'm hosting dies, or if you just want to host a mirror, here are instructions for running the backend part of this script!

1. Install nginx, whatever process manager you want (supervisor is good), a firewall, redis-server, postgresql, python3, pip3, and python venv
2. Clone this repo
3. Run `python3 -m venv venv` inside the directory, activate the venv with `source venv/bin/activate` and then install all the python requirements with `python3 -m pip install -r requirements.txt`
4. Set up your process manager to run this command using the python installation inside your venv `gunicorn -w 2 -k eventlet -b 127.0.0.1:6666 fps_proxy:app`
5. Setup nginx as a reverse proxy that routes traffic from the /bp_api location to the port you ran the server on, in my example, 6666. Also, set up cors headers on all main requests (with your nginx config that is).
6. Set up the config for your redis server, I'd recommend only having it accept connections from loopback (localhost, 127.0.0.1). It's used as a cache here, so you'll want to specify a maximum size and a key eviction policy, I use 250MB and allkeys-lfu. Once all this is sorted, set it up to run using a process manager also, probably use init.d for this. If you install via your package manager it'll likely do this as part of the installation, you'll just need to modify it to use your edited configuration instead of the default, have a look in /etc/init.d/redis-server that's probably the location.
7. Set up a database and a user which has access to only that database with postgres. Make a copy of the file `config.json.example` renaming it to `config.json` and place the login details for that user into that file. Modify the file `db_config.py` so that the code below the \_\_main\_\_ statement runs the function `create_database()`. Once you've run the file once and the database has it's tables added, restore `db_config.py` to it's previous state and set it up with cron to run on a sensible interval, I suggest once daily.
