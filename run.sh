#!/bin/sh

export HUBOT_GLIP_SERVER=https://platform.devtest.ringcentral.com
export HUBOT_GLIP_APP_KEY=your_key_here
export HUBOT_GLIP_APP_SECRET=your_key_secret_here
export HUBOT_GLIP_EXTENSION=101
export HUBOT_GLIP_USERNAME=your_user_name
export HUBOT_GLIP_PASSWORD=your_passwd

./bin/hubot -a glip -n "X"
