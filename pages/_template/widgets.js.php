<?
$userDir = urldecode($_GET['user_directory']);

function userInclude($file) {
    global $userDir;
    include($_SERVER['DOCUMENT_ROOT'] . DIRECTORY_SEPARATOR . $userDir . DIRECTORY_SEPARATOR . $file);
}

// put your custom widget js here:
// example:
//  userInclude("homematic/widget_homematic.js");

?>

