This is a customized package of smartVISU for use with fhem and fronthem

THIS WORK IS BASED ON smartVISU.de, 
CREDITS AND THANKS TO MARTIN GLEISS

license     GPL [http://www.gnu.de]

Extension for fhem and fronthem by Joerg Herrmann
see fhem.de

DISCRIPTION
--------------------------------------------------------------------------------
smartVISU is a framework to create a visualisation with simple html-pages.
You don't need to know javascript, but if you know you will have a lot mor fun


SYSTEMREQUIREMENTS
--------------------------------------------------------------------------------
    -   fhem with fronthem and a working local webserver with php support
 
3 STEP FIRST SETUP GUIDE:
--------------------------------------------------------------------------------

    For the first setup do the following:
    
    1. cd to the www-root folder of your installation
    2. use git clone https://github.com/herrmannj/smartvisu-cleaninstall.git smartvisu
    3. COPY config.ini.default to config.ini with cp config.ini.default config.ini
   
 
10 STEP PERSONALIZATION GUIDE:
--------------------------------------------------------------------------------

    For your own Project do the following:
    
    1.  Create a new directory in "pages", for example "pages/visu" or 
        "pages/YOURPROJECT". This is your individual project-directory where you
		may work. Copy all files from "pages/_template" to your project-directory
    
    2.  Check the config.ini and set the "config_pages" to "YOURPROJECT"
      
    3.  Set the "config_driver" to your backend-environment
        - fhem: domotiga.js or fronthem.js, port 2121
        - offline: only for testing, all GADs will be stored in a textfile 
          ("temp/offline_YOURPROJECT.var")
        
    4.  Create a new page in your project-directory, for example "mypage.html"
        Note: Do not use "base.html, basic.html, device.html", these are system
        pages
    
    5.  Fill the page with your preferred content and widgets
    
    6.  If you need to change the design, use a "visu.css" - stylesheet file in 
        your project-directory. 
		If you wand to develop own widgets, also place them in your directory.
		Name the javascript-file (if you need on) to "visu.js" and it will be
		included automatically. Name the file with the widgets e. g. "custom.html"
    
    7.  Test your page with:
        http://localhost/smartVISU/index.php?page=mypage
        Note: replace "localhost" with your hostname from your server      
   
    8.  Create all pages you need
     
    9.  At the end of your project set "config_cache" to "true" to speed up your
        smartVISU
        
   10.  Enjoy smartVISU!
        
 
1 STEP UPDATE GUIDE:
--------------------------------------------------------------------------------

    1.  use git pull in the ../smartvisu folder to refresh smartvisu from git
        (all your personal files will not be touched!)
        
        If you changed original files of this git in your local installation this will fail.
        Use git pull and follow the instructions. Your personalized changes will get lost.
        Change only your own files!



