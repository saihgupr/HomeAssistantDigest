#!/bin/bash

#!/bin/bash

ssh root@192.168.1.4 'nohup sh -c "ha addons reload && ha addons rebuild local_ha-digest" >/dev/null 2>&1 &'