import   wishlistServise from '../services/wishlistService.js'

const addToWishlist = async( req , res , next)=>{
    try {
        const {product_id} =req.body ;

        if(!product_id){
            return res.status(400).json({
                success:false ,
                message: 'product is is needed'
            })
        }

        const wishlist = await wishlistServise.addToWishlist(req.user.id , product_id);
        res.status(201).json({
            success:true,
            message:'product added to wishlist ',
            data :wishlist
        })}catch(error){
     next(error)
}
        
    };

    const getWishlist = async (req , res , next )=>{
        try{
            const wishlist = await wishlistServise.getWishlist(req.user.id);

            res.status(200).json({

                success:true,
                count :wishlist.length,
                
                data :wishlist
            })

        }catch(error){
            next(error)

        }
    }

    const removeFromWishlist = async(req, res , next )=>{
        try{
            
       const result = await wishlistServise.removeFromWishlist(req.params.id,req.user.id);


       res.status(200).json({
        success:true,
        message :'wishlist removed '
       })

        }catch(error){
            next(error)
        }
    }

  export { addToWishlist, getWishlist, removeFromWishlist };
