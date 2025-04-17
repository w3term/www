(
    cat index.html | egrep -v 'index.js|index.css'
    echo "\n<style>"
    cat index.css
    echo "\n</style>"
    echo "\n<script>"
    cat index.js
    echo "\n</script>"
)