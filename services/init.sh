#!/bin/bash

curl -X DELETE http://localhost:9200/npm

curl -XPOST http://localhost:9200/npm -d '{
    "mappings" : {
        "package" : {
            "properties" : {
                "dependencies" : { "type" : "string", "position_offset_gap" : 100 }
            }
        }
    }
}'
